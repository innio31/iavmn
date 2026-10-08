// src/controllers/applicationController.js
// Public: apply form (per tier), submission with CV + photo uploads.
// Admin: list with filters, view detail, approve/reject, delete.
//
// IMPORTANT: When admin approves an application, we create a member record,
// generate a set-password token, and email the new member a welcome link
// so they can activate their portal account.

import { body, validationResult } from 'express-validator';
import {
  generateReference,
  listApplications,
  countApplications,
  findApplicationById,
  findApplicationByReference,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
  getApplicationCounts,
} from '../models/applicationModel.js';
import { findTierBySlug, findTierById } from '../models/tierModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import {
  findMemberByApplicationId,
  createMemberFromApplication,
  generateResetToken,
  findMemberById,
} from '../models/memberModel.js';
import { deleteUploadedFile } from '../utils/fileCleanup.js';
import { sendMail } from '../services/mailer.js';
import { emit } from '../services/eventBus.js';
import { clearCountsCache } from '../middleware/notificationCounts.js';

// ─── Validation ─────────────────────────────────────────

export const applicationValidators = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 180 })
    .withMessage('Full name must be between 2 and 180 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .isLength({ max: 180 })
    .withMessage('Email is too long.'),
  body('phone')
    .trim()
    .isLength({ min: 7, max: 40 })
    .withMessage('Phone number must be between 7 and 40 characters.'),
  body('address')
    .trim()
    .isLength({ min: 5, max: 300 })
    .withMessage('Address must be between 5 and 300 characters.'),
  body('employer')
    .optional({ checkFalsy: true })
    .isLength({ max: 200 })
    .withMessage('Employer cannot exceed 200 characters.'),
  body('qualifications')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 })
    .withMessage('Qualifications cannot exceed 2000 characters.'),
  body('years_experience')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 80 })
    .withMessage('Years of experience must be a number between 0 and 80.'),
  body('agree')
    .equals('1')
    .withMessage('You must confirm that the information provided is accurate.'),
];

// ─── Public: show apply form for a tier ─────────────────

export const showApplyForm = async (req, res, next) => {
  const tier = await findTierBySlug(req.params.slug);
  if (!tier) return next();

  const settings = await getAllSettings();
  const paystackEnabled = settings.paystack_enabled === '1';
  const tierHasFee = Number(tier.fee_amount) > 0;

  res.render('membership/apply', {
    title: 'Apply for ' + tier.name,
    tier,
    form: {
      full_name: (req.session.user && req.session.user.name) || '',
      email: (req.session.user && req.session.user.email) || '',
      phone: '',
      address: '',
      employer: '',
      qualifications: '',
      years_experience: '',
      agree: '',
    },
    errors: [],
    paystackEnabled: paystackEnabled && tierHasFee,
  });
};

// ─── Public: submit apply form ──────────────────────────

export const postApplyForm = async (req, res, next) => {
  const tier = await findTierBySlug(req.params.slug);
  if (!tier) {
    if (req.files) {
      const files = Object.values(req.files).flat();
      for (const f of files) {
        if (f && f.publicPath) await deleteUploadedFile(f.publicPath, ['applications']);
      }
    }
    return next();
  }

  const result = validationResult(req);
  const cvFile = req.files && req.files.cv ? req.files.cv[0] : null;
  const photoFile = req.files && req.files.photo ? req.files.photo[0] : null;

  const fileErrors = [];
  if (!cvFile) fileErrors.push({ msg: 'Please upload your CV (PDF, DOC, or DOCX).' });
  if (!photoFile) fileErrors.push({ msg: 'Please upload a passport photograph.' });

  if (!result.isEmpty() || fileErrors.length) {
    if (cvFile && cvFile.publicPath) await deleteUploadedFile(cvFile.publicPath, ['applications']);
    if (photoFile && photoFile.publicPath) await deleteUploadedFile(photoFile.publicPath, ['applications']);

    const errs = [...result.array(), ...fileErrors];
    const settings = await getAllSettings();
    const paystackEnabled = settings.paystack_enabled === '1';
    const tierHasFee = Number(tier.fee_amount) > 0;

    return res.status(422).render('membership/apply', {
      title: 'Apply for ' + tier.name,
      tier,
      form: {
        full_name: req.body.full_name || '',
        email: req.body.email || '',
        phone: req.body.phone || '',
        address: req.body.address || '',
        employer: req.body.employer || '',
        qualifications: req.body.qualifications || '',
        years_experience: req.body.years_experience || '',
        agree: req.body.agree || '',
      },
      errors: errs,
      paystackEnabled: paystackEnabled && tierHasFee,
    });
  }

  const reference = await generateReference();

  const id = await createApplication({
    reference,
    tier_id: tier.id,
    full_name: req.body.full_name.trim(),
    email: req.body.email.trim().toLowerCase(),
    phone: (req.body.phone || '').trim() || null,
    address: (req.body.address || '').trim() || null,
    employer: (req.body.employer || '').trim() || null,
    qualifications: (req.body.qualifications || '').trim() || null,
    years_experience: req.body.years_experience ? Number(req.body.years_experience) : null,
    cv_path: cvFile.publicPath,
    photo_path: photoFile.publicPath,
  });

  clearCountsCache();

  // Real-time event for admin dashboards
  try {
    const application = await findApplicationById(id);
    emit('application:new', {
      id: application.id,
      reference: application.reference,
      full_name: application.full_name,
      email: application.email,
      tier_name: application.tier_name,
      payment_status: application.payment_status,
      status: application.status,
      created_at: application.created_at,
    });
  } catch (err) {
    console.error('[apply] emit failed:', err.message);
  }

  // Notification emails (best effort)
  try {
    const application = await findApplicationById(id);
    const settings = await getAllSettings();

    await sendMail({
      to: application.email,
      subject: `Application received — ${application.reference}`,
      template: 'application-received',
      data: {
        application,
        appName: process.env.APP_NAME || 'IAVMN',
        settings,
      },
    });

    const recipient =
      (settings.mail_admin_recipient && settings.mail_admin_recipient.trim()) ||
      (settings.contact_email && settings.contact_email.trim()) ||
      process.env.MAIL_FROM_EMAIL ||
      null;

    if (recipient) {
      await sendMail({
        to: recipient,
        replyTo: application.email,
        subject: `New membership application — ${application.reference}`,
        template: 'application-admin-notification',
        data: {
          application,
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });
    }
  } catch (err) {
    console.error('[apply] notification emails failed:', err.message);
  }

  const settings = await getAllSettings();
  const paystackEnabled = settings.paystack_enabled === '1';
  const tierHasFee = Number(tier.fee_amount) > 0;

  if (paystackEnabled && tierHasFee) {
    return res.redirect(`/membership/apply/${reference}/pay`);
  }

  return res.redirect(`/membership/apply/${reference}/success`);
};

// ─── Public: success page ───────────────────────────────

export const showApplicationSuccess = async (req, res, next) => {
  const application = await findApplicationByReference(req.params.reference);
  if (!application) return next();

  res.render('membership/apply-success', {
    title: 'Application Submitted',
    application,
  });
};

// ─── Admin: list ────────────────────────────────────────

export const listApplicationsAdmin = async (req, res) => {
  const statusFilter = ['submitted', 'under_review', 'approved', 'rejected'].includes(req.query.status)
    ? req.query.status
    : null;
  const paymentFilter = ['pending', 'paid', 'failed', 'refunded'].includes(req.query.payment)
    ? req.query.payment
    : null;

  const [applications, counts] = await Promise.all([
    listApplications({ status: statusFilter, paymentStatus: paymentFilter }),
    getApplicationCounts(),
  ]);

  res.render('admin/applications/list', {
    title: 'Membership Applications',
    layout: 'layouts/admin',
    applications,
    counts,
    statusFilter,
    paymentFilter,
  });
};

// ─── Admin: view ────────────────────────────────────────

export const showApplicationAdmin = async (req, res) => {
  const application = await findApplicationById(req.params.id);
  if (!application) {
    req.flash('error', 'Application not found.');
    return res.redirect('/admin/applications');
  }

  const member = await findMemberByApplicationId(application.id);

  res.render('admin/applications/view', {
    title: 'Application ' + application.reference,
    layout: 'layouts/admin',
    application,
    member,
  });
};

// ─── Admin: update status ───────────────────────────────

export const postUpdateApplicationStatus = async (req, res) => {
  const application = await findApplicationById(req.params.id);
  if (!application) {
    req.flash('error', 'Application not found.');
    return res.redirect('/admin/applications');
  }

  const allowed = ['submitted', 'under_review', 'approved', 'rejected'];
  const status = allowed.includes(req.body.status) ? req.body.status : null;
  if (!status) {
    req.flash('error', 'Invalid status.');
    return res.redirect(`/admin/applications/${application.id}`);
  }

  const notes = (req.body.admin_notes || '').trim() || null;
  await updateApplicationStatus(application.id, status, notes);
  clearCountsCache();

  // Real-time event for admin dashboards
  try {
    emit('application:status', {
      id: application.id,
      reference: application.reference,
      full_name: application.full_name,
      from_status: application.status,
      to_status: status,
    });
  } catch (err) {
    console.error('[application status] emit failed:', err.message);
  }

  // ─── Approval hook: create member + send welcome email ───
  if (status === 'approved') {
    try {
      const existingMember = await findMemberByApplicationId(application.id);

      if (existingMember) {
        req.flash(
          'success',
          `Application approved. Member ${existingMember.member_number} already exists for this application.`
        );
        return res.redirect(`/admin/applications/${application.id}`);
      }

      const memberId = await createMemberFromApplication(application, 12); // 12 months
      const member = await findMemberById(memberId);

      const token = await generateResetToken(memberId, 2880); // 48 hours
      const settings = await getAllSettings();

      await sendMail({
        to: member.email,
        subject: `Welcome to IAVMN — activate your member portal`,
        template: 'member-welcome',
        data: {
          member,
          token,
          application,
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });

      // Real-time event: new member created
      try {
        emit('member:new', {
          id: member.id,
          member_number: member.member_number,
          full_name: member.full_name,
          email: member.email,
          tier_name: member.tier_name,
        });
      } catch (err) {
        console.error('[member new] emit failed:', err.message);
      }

      req.flash(
        'success',
        `Application approved. Member ${member.member_number} created — welcome email sent to ${member.email}.`
      );
      return res.redirect(`/admin/applications/${application.id}`);
    } catch (err) {
      console.error('[approval hook] failed:', err.message);
      req.flash(
        'error',
        'Application approved, but we could not create the member account. Please check the logs.'
      );
      return res.redirect(`/admin/applications/${application.id}`);
    }
  }

  // Rejected → send decision email
  if (status === 'rejected') {
    try {
      const settings = await getAllSettings();
      await sendMail({
        to: application.email,
        subject: `Your IAVMN application has been rejected`,
        template: 'application-decision',
        data: {
          application: { ...application, status, admin_notes: notes },
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });
    } catch (err) {
      console.error('[decision email] failed:', err.message);
    }
  }

  req.flash('success', 'Application status updated.');
  res.redirect(`/admin/applications/${application.id}`);
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteApplication = async (req, res) => {
  const application = await findApplicationById(req.params.id);
  if (!application) {
    req.flash('error', 'Application not found.');
    return res.redirect('/admin/applications');
  }

  if (application.cv_path) {
    await deleteUploadedFile(application.cv_path, ['applications']);
  }
  if (application.photo_path) {
    await deleteUploadedFile(application.photo_path, ['applications']);
  }

  await deleteApplication(application.id);
  clearCountsCache();
  req.flash('success', 'Application deleted.');
  res.redirect('/admin/applications');
};