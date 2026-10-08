// src/controllers/adminMemberController.js
// Admin: list members, view member detail, edit status/tier/expiry,
// reset password, resend welcome email.

import { body, validationResult } from 'express-validator';
import {
  listMembers,
  countMembers,
  findMemberById,
  findMemberByApplicationId,
  updateMemberAdmin,
  setMemberStatus,
  setMemberPassword,
  generateResetToken,
  clearResetToken,
  deleteMember,
} from '../models/memberModel.js';
import { findApplicationById, updateApplicationStatus } from '../models/applicationModel.js';
import { listTiers } from '../models/tierModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { deleteUploadedFile } from '../utils/fileCleanup.js';
import { sendMail } from '../services/mailer.js';
import { emit } from '../services/eventBus.js';
import { clearCountsCache } from '../middleware/notificationCounts.js';

// ─── Validation ─────────────────────────────────────────

export const memberEditValidators = [
  body('tier_id').isInt({ min: 1 }).withMessage('Please choose a valid tier.'),
  body('status')
    .isIn(['pending', 'active', 'suspended', 'expired', 'cancelled'])
    .withMessage('Invalid status.'),
  body('expires_at')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Expiry date must be a valid date.'),
  body('notes')
    .optional({ checkFalsy: true })
    .isLength({ max: 2000 })
    .withMessage('Notes cannot exceed 2000 characters.'),
];

export const memberPasswordValidators = [
  body('new_password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be at least 8 characters.'),
];

// ─── Helpers ────────────────────────────────────────────

const toDateTime = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace('T', ' ');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

const formatForInput = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Admin: list members ────────────────────────────────

export const listMembersAdmin = async (req, res) => {
  const statusFilter = ['active', 'pending', 'suspended', 'expired', 'cancelled'].includes(req.query.status)
    ? req.query.status
    : null;
  const tierFilter = req.query.tier && Number.isFinite(Number(req.query.tier))
    ? Number(req.query.tier)
    : null;

  const [members, totalCount, activeCount, tierOptions] = await Promise.all([
    listMembers({ status: statusFilter, tierId: tierFilter }),
    countMembers(),
    countMembers({ status: 'active' }),
    listTiers(false),
  ]);

  res.render('admin/members/list', {
    title: 'Members',
    layout: 'layouts/admin',
    members,
    totalCount,
    activeCount,
    tierOptions,
    statusFilter,
    tierFilter,
  });
};

// ─── Admin: view member ─────────────────────────────────

export const showMemberAdmin = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Member not found.');
    return res.redirect('/admin/members');
  }

  const [tierOptions, application] = await Promise.all([
    listTiers(false),
    member.application_id ? findApplicationById(member.application_id) : Promise.resolve(null),
  ]);

  res.render('admin/members/view', {
    title: 'Member ' + member.member_number,
    layout: 'layouts/admin',
    member,
    tierOptions,
    application,
    expiresAtInput: formatForInput(member.expires_at),
  });
};

// ─── Admin: edit member ─────────────────────────────────

export const postEditMember = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Member not found.');
    return res.redirect('/admin/members');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    req.flash('error', result.array()[0].msg);
    return res.redirect(`/admin/members/${member.id}`);
  }

  const tierId = Number(req.body.tier_id);
  const status = req.body.status;
  const expiresAt = toDateTime(req.body.expires_at);
  const notes = (req.body.notes || '').trim() || null;

  await updateMemberAdmin(member.id, {
    tier_id: tierId,
    status,
    expires_at: expiresAt,
    notes,
  });

  clearCountsCache();

  // Real-time event
  try {
    emit('member:updated', {
      id: member.id,
      member_number: member.member_number,
      full_name: member.full_name,
      from_status: member.status,
      to_status: status,
    });
  } catch (err) {
    console.error('[member edit] emit failed:', err.message);
  }

  req.flash('success', 'Member updated.');
  res.redirect(`/admin/members/${member.id}`);
};

// ─── Admin: toggle status (quick action) ────────────────

export const postToggleMemberStatus = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Member not found.');
    return res.redirect('/admin/members');
  }

  const next = req.body.next_status;
  const allowed = ['active', 'pending', 'suspended', 'expired', 'cancelled'];
  if (!allowed.includes(next)) {
    req.flash('error', 'Invalid status.');
    return res.redirect(`/admin/members/${member.id}`);
  }

  await setMemberStatus(member.id, next);
  clearCountsCache();

  try {
    emit('member:updated', {
      id: member.id,
      member_number: member.member_number,
      full_name: member.full_name,
      from_status: member.status,
      to_status: next,
    });
  } catch (err) {
    console.error('[member status] emit failed:', err.message);
  }

  req.flash('success', `Member status changed to ${next}.`);
  res.redirect(`/admin/members/${member.id}`);
};

// ─── Admin: change password directly ────────────────────

export const postSetMemberPassword = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Member not found.');
    return res.redirect('/admin/members');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    req.flash('error', result.array()[0].msg);
    return res.redirect(`/admin/members/${member.id}`);
  }

  await setMemberPassword(member.id, req.body.new_password);
  req.flash('success', 'Password updated. Share it with the member securely.');
  res.redirect(`/admin/members/${member.id}`);
};

// ─── Admin: send a fresh set-password / reset link ──────

export const postSendResetLink = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Member not found.');
    return res.redirect('/admin/members');
  }

  try {
    const token = await generateResetToken(member.id, 60); // 1 hour
    const settings = await getAllSettings();
    const template = member.is_verified ? 'member-password-reset' : 'member-welcome';

    await sendMail({
      to: member.email,
      subject: member.is_verified
        ? 'Reset your IAVMN password'
        : 'Welcome to IAVMN — activate your member portal',
      template,
      data: {
        member,
        token,
        application: null,
        appName: process.env.APP_NAME || 'IAVMN',
        settings,
      },
    });

    req.flash('success', `Link sent to ${member.email}.`);
  } catch (err) {
    console.error('[member reset] send failed:', err.message);
    req.flash('error', 'Could not send the email. Please try again.');
  }

  res.redirect(`/admin/members/${member.id}`);
};

// ─── Admin: resend welcome (from application view) ──────

export const postResendWelcome = async (req, res) => {
  const application = await findApplicationById(req.params.id);
  if (!application) {
    req.flash('error', 'Application not found.');
    return res.redirect('/admin/applications');
  }

  const member = await findMemberByApplicationId(application.id);
  if (!member) {
    req.flash('error', 'No member account exists for this application yet.');
    return res.redirect(`/admin/applications/${application.id}`);
  }

  try {
    const token = await generateResetToken(member.id, 60);
    const settings = await getAllSettings();
    const template = member.is_verified ? 'member-password-reset' : 'member-welcome';

    await sendMail({
      to: member.email,
      subject: member.is_verified
        ? 'Reset your IAVMN password'
        : 'Welcome to IAVMN — activate your member portal',
      template,
      data: {
        member,
        token,
        application,
        appName: process.env.APP_NAME || 'IAVMN',
        settings,
      },
    });

    req.flash('success', `Link sent to ${member.email}.`);
  } catch (err) {
    console.error('[resend welcome] failed:', err.message);
    req.flash('error', 'Could not send the email. Please try again.');
  }

  res.redirect(`/admin/applications/${application.id}`);
};

// ─── Admin: delete member ───────────────────────────────

export const postDeleteMember = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Member not found.');
    return res.redirect('/admin/members');
  }

  if (member.photo_path && !member.application_id) {
    await deleteUploadedFile(member.photo_path, ['applications']);
  }

  await deleteMember(member.id);
  clearCountsCache();
  req.flash('success', 'Member deleted.');
  res.redirect('/admin/members');
};