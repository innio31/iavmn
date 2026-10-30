// src/controllers/apiAdminController.js
// Admin API endpoints. Mirrors web admin controllers but returns JSON.
// req.user is set by requireAdminJWT.

import {
  listApplications,
  findApplicationById,
  updateApplicationStatus,
  getApplicationCounts,
} from '../models/applicationModel.js';
import {
  listMembers,
  countMembers,
  findMemberById,
  findMemberByApplicationId,
  updateMemberAdmin,
  setMemberStatus,
  setMemberPassword,
  generateResetToken,
  createMemberFromApplication,
} from '../models/memberModel.js';
import {
  listMessages,
  countMessages,
  findMessageById,
  setMessageRead,
} from '../models/contactModel.js';
import {
  listSubscribers,
  countSubscribers,
  exportActiveSubscribers,
} from '../models/subscriberModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { sendMail } from '../services/mailer.js';
import { emit } from '../services/eventBus.js';
import { clearCountsCache } from '../middleware/notificationCounts.js';
import { revokeAllForUser } from '../services/jwtService.js';

// ─── Dashboard ──────────────────────────────────────────

export const getDashboard = async (req, res, next) => {
  try {
    const [appCounts, memberCounts, unreadMessages, totalMessages, activeSubs, totalSubs, recentApps] =
      await Promise.all([
        getApplicationCounts(),
        countMembersAll(),
        countMessages(true),
        countMessages(false),
        countSubscribers(true),
        countSubscribers(false),
        listApplications({ limit: 5 }),
      ]);

    return res.json({
      applications: appCounts,
      members: memberCounts,
      messages: { unread: unreadMessages, total: totalMessages },
      subscribers: { active: activeSubs, total: totalSubs },
      recent_applications: recentApps.map(slimApp),
    });
  } catch (err) {
    next(err);
  }
};

// countMembers() takes {status}; we need the full breakdown like getMemberCounts().
// Since there's no exported getMemberCounts equivalent that returns the same shape as web,
// call the model's getMemberCounts via dynamic import to avoid duplicate SQL.
const countMembersAll = async () => {
  const { getMemberCounts } = await import('../models/memberModel.js');
  return getMemberCounts();
};

// ─── Serializers ────────────────────────────────────────

const slimApp = (a) => ({
  id: a.id,
  reference: a.reference,
  full_name: a.full_name,
  email: a.email,
  tier_name: a.tier_name || null,
  status: a.status,
  payment_status: a.payment_status,
  created_at: a.created_at,
});

const fullApp = (a) => ({
  id: a.id,
  reference: a.reference,
  tier_id: a.tier_id,
  tier_name: a.tier_name || null,
  tier_slug: a.tier_slug || null,
  tier_currency: a.tier_currency || 'NGN',
  tier_fee: a.tier_fee != null ? Number(a.tier_fee) : null,
  tier_registration_fee: a.tier_registration_fee != null ? Number(a.tier_registration_fee) : null,
  full_name: a.full_name,
  email: a.email,
  phone: a.phone,
  address: a.address,
  employer: a.employer,
  qualifications: a.qualifications,
  years_experience: a.years_experience,
  cv_path: a.cv_path,
  photo_path: a.photo_path,
  payment_status: a.payment_status,
  payment_reference: a.payment_reference,
  payment_amount: a.payment_amount != null ? Number(a.payment_amount) : null,
  payment_currency: a.payment_currency,
  payment_paid_at: a.payment_paid_at,
  status: a.status,
  admin_notes: a.admin_notes,
  created_at: a.created_at,
  updated_at: a.updated_at,
});

const slimMember = (m) => ({
  id: m.id,
  member_number: m.member_number,
  full_name: m.full_name,
  email: m.email,
  status: m.status,
  tier_id: m.tier_id,
  tier_name: m.tier_name || null,
  expires_at: m.expires_at,
  created_at: m.created_at,
});

const fullMember = (m) => ({
  ...slimMember(m),
  application_id: m.application_id,
  phone: m.phone,
  address: m.address,
  employer: m.employer,
  qualifications: m.qualifications,
  years_experience: m.years_experience,
  photo_path: m.photo_path,
  is_verified: m.is_verified,
  verified_at: m.verified_at,
  joined_at: m.joined_at,
  last_login_at: m.last_login_at,
  notes: m.notes,
  updated_at: m.updated_at,
});

// ─── Applications ───────────────────────────────────────

export const listApplicationsAdmin = async (req, res, next) => {
  try {
    const status = ['submitted', 'under_review', 'approved', 'rejected'].includes(req.query.status)
      ? req.query.status
      : null;
    const paymentStatus = ['pending', 'paid', 'failed', 'refunded'].includes(req.query.payment)
      ? req.query.payment
      : null;

    const apps = await listApplications({ status, paymentStatus });
    return res.json({ applications: apps.map(slimApp), filters: { status, payment: paymentStatus } });
  } catch (err) {
    next(err);
  }
};

export const getApplicationAdmin = async (req, res, next) => {
  try {
    const application = await findApplicationById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.', code: 'NOT_FOUND' });

    const member = await findMemberByApplicationId(application.id);
    return res.json({
      application: fullApp(application),
      member: member ? slimMember(member) : null,
    });
  } catch (err) {
    next(err);
  }
};

export const updateApplicationStatusAdmin = async (req, res, next) => {
  try {
    const allowed = ['submitted', 'under_review', 'approved', 'rejected'];
    const status = allowed.includes(req.body?.status) ? req.body.status : null;
    if (!status) return res.status(422).json({ error: 'Invalid status.', code: 'VALIDATION' });

    const application = await findApplicationById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.', code: 'NOT_FOUND' });

    const notes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim() || null : null;

    await updateApplicationStatus(application.id, status, notes);
    clearCountsCache();

    try {
      emit('application:status', {
        id: application.id,
        reference: application.reference,
        full_name: application.full_name,
        from_status: application.status,
        to_status: status,
      });
    } catch (e) {
      console.error('[api application status] emit failed:', e.message);
    }

    if (status === 'approved') {
      return await handleApproval(req, res, application);
    }

    if (status === 'rejected') {
      // Mirror web: send rejection email, but don't fail the response on mail errors.
      try {
        const settings = await getAllSettings();
        await sendMail({
          to: application.email,
          subject: 'Your IAVMN application has been rejected',
          template: 'application-decision',
          data: {
            application: { ...application, status, admin_notes: notes },
            appName: process.env.APP_NAME || 'IAVMN',
            settings,
          },
        });
      } catch (e) {
        console.error('[api rejection email] failed:', e.message);
      }
    }

    return res.json({
      ok: true,
      message: 'Application status updated.',
      application: fullApp({ ...application, status, admin_notes: notes }),
    });
  } catch (err) {
    next(err);
  }
};

const handleApproval = async (req, res, application) => {
  try {
    const existing = await findMemberByApplicationId(application.id);
    if (existing) {
      return res.json({
        ok: true,
        already_member: true,
        message: `Application approved. Member ${existing.member_number} already exists for this application.`,
        member: slimMember(existing),
      });
    }

    const memberId = await createMemberFromApplication(application, 12);
    const member = await findMemberById(memberId);
    const token = await generateResetToken(memberId, 2880); // 48h, matches web
    const settings = await getAllSettings();

    await sendMail({
      to: member.email,
      subject: 'Welcome to IAVMN — activate your member portal',
      template: 'member-welcome',
      data: {
        member,
        token,
        application,
        appName: process.env.APP_NAME || 'IAVMN',
        settings,
      },
    });

    try {
      emit('member:new', {
        id: member.id,
        member_number: member.member_number,
        full_name: member.full_name,
        email: member.email,
        tier_name: member.tier_name,
      });
    } catch (e) {
      console.error('[api member:new] emit failed:', e.message);
    }

    return res.json({
      ok: true,
      message: `Application approved. Member ${member.member_number} created — welcome email sent.`,
      member: slimMember(member),
    });
  } catch (e) {
    console.error('[api approval hook] failed:', e.message);
    return res.status(500).json({
      error: 'Application approved, but member creation failed. Please check logs.',
      code: 'APPROVAL_HOOK_FAILED',
    });
  }
};

export const resendWelcomeAdmin = async (req, res, next) => {
  try {
    const application = await findApplicationById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.', code: 'NOT_FOUND' });

    const member = await findMemberByApplicationId(application.id);
    if (!member) {
      return res.status(400).json({ error: 'No member account exists for this application yet.', code: 'NO_MEMBER' });
    }

    const token = await generateResetToken(member.id, 60);
    const settings = await getAllSettings();
    const template = member.is_verified ? 'member-password-reset' : 'member-welcome';
    const subject = member.is_verified
      ? 'Reset your IAVMN password'
      : 'Welcome to IAVMN — activate your member portal';

    await sendMail({
      to: member.email,
      subject,
      template,
      data: { member, token, application, appName: process.env.APP_NAME || 'IAVMN', settings },
    });

    return res.json({ ok: true, message: `Email sent to ${member.email}.` });
  } catch (err) {
    next(err);
  }
};

// ─── Members ────────────────────────────────────────────

export const listMembersAdmin = async (req, res, next) => {
  try {
    const status = ['active', 'pending', 'suspended', 'expired', 'cancelled'].includes(req.query.status)
      ? req.query.status
      : null;
    const tierId = req.query.tier && Number.isFinite(Number(req.query.tier)) ? Number(req.query.tier) : null;

    const members = await listMembers({ status, tierId });
    return res.json({ members: members.map(slimMember), filters: { status, tier: tierId } });
  } catch (err) {
    next(err);
  }
};

export const getMemberAdmin = async (req, res, next) => {
  try {
    const member = await findMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    const application = member.application_id ? await findApplicationById(member.application_id) : null;
    return res.json({
      member: fullMember(member),
      application: application ? slimApp(application) : null,
    });
  } catch (err) {
    next(err);
  }
};

export const patchMemberAdmin = async (req, res, next) => {
  try {
    const member = await findMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    const b = req.body || {};
    const errors = {};

    const tierId = b.tier_id !== undefined ? Number(b.tier_id) : member.tier_id;
    if (!Number.isInteger(tierId) || tierId < 1) errors.tier_id = 'Please choose a valid tier.';

    const status = b.status !== undefined ? b.status : member.status;
    if (!['pending', 'active', 'suspended', 'expired', 'cancelled'].includes(status)) {
      errors.status = 'Invalid status.';
    }

    let expiresAt = member.expires_at;
    if (b.expires_at !== undefined) {
      if (b.expires_at === null || b.expires_at === '') expiresAt = null;
      else {
        const d = new Date(String(b.expires_at).replace('T', ' '));
        if (Number.isNaN(d.getTime())) errors.expires_at = 'Expiry date must be a valid date.';
        else {
          const pad = (n) => String(n).padStart(2, '0');
          expiresAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        }
      }
    }

    let notes = member.notes;
    if (b.notes !== undefined) {
      const s = String(b.notes || '').trim();
      if (s.length > 2000) errors.notes = 'Notes cannot exceed 2000 characters.';
      else notes = s || null;
    }

    if (Object.keys(errors).length) {
      return res.status(422).json({ error: 'Please correct the highlighted fields.', code: 'VALIDATION', errors });
    }

    await updateMemberAdmin(member.id, {
      tier_id: tierId,
      status,
      expires_at: expiresAt,
      notes,
    });
    clearCountsCache();

    try {
      emit('member:updated', {
        id: member.id,
        member_number: member.member_number,
        full_name: member.full_name,
        from_status: member.status,
        to_status: status,
      });
    } catch (e) {
      console.error('[api member update] emit failed:', e.message);
    }

    // If the admin suspended/cancelled/expired the member, revoke mobile sessions.
    if (['suspended', 'cancelled', 'expired'].includes(status) && status !== member.status) {
      await revokeAllForUser('member', member.id);
    }

    const updated = await findMemberById(member.id);
    return res.json({ ok: true, member: fullMember(updated) });
  } catch (err) {
    next(err);
  }
};

export const setMemberStatusAdmin = async (req, res, next) => {
  try {
    const member = await findMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    const next_ = req.body?.next_status || req.body?.status;
    const allowed = ['active', 'pending', 'suspended', 'expired', 'cancelled'];
    if (!allowed.includes(next_)) {
      return res.status(422).json({ error: 'Invalid status.', code: 'VALIDATION' });
    }

    await setMemberStatus(member.id, next_);
    clearCountsCache();

    try {
      emit('member:updated', {
        id: member.id,
        member_number: member.member_number,
        full_name: member.full_name,
        from_status: member.status,
        to_status: next_,
      });
    } catch (e) {
      console.error('[api member status] emit failed:', e.message);
    }

    if (['suspended', 'cancelled', 'expired'].includes(next_)) {
      await revokeAllForUser('member', member.id);
    }

    const updated = await findMemberById(member.id);
    return res.json({ ok: true, member: fullMember(updated) });
  } catch (err) {
    next(err);
  }
};

export const sendMemberResetAdmin = async (req, res, next) => {
  try {
    const member = await findMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    const token = await generateResetToken(member.id, 60);
    const settings = await getAllSettings();
    const template = member.is_verified ? 'member-password-reset' : 'member-welcome';
    const subject = member.is_verified
      ? 'Reset your IAVMN password'
      : 'Welcome to IAVMN — activate your member portal';

    await sendMail({
      to: member.email,
      subject,
      template,
      data: { member, token, application: null, appName: process.env.APP_NAME || 'IAVMN', settings },
    });

    return res.json({ ok: true, message: `Link sent to ${member.email}.` });
  } catch (err) {
    next(err);
  }
};

export const setMemberPasswordAdmin = async (req, res, next) => {
  try {
    const newPassword = String(req.body?.new_password || '');
    if (newPassword.length < 8 || newPassword.length > 100) {
      return res.status(422).json({
        error: 'Password must be at least 8 characters.',
        code: 'VALIDATION',
        errors: { new_password: 'Password must be at least 8 characters.' },
      });
    }

    const member = await findMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    await setMemberPassword(member.id, newPassword);
    // Force re-login everywhere since the password changed.
    await revokeAllForUser('member', member.id);

    return res.json({ ok: true, message: 'Password updated. Share it with the member securely.' });
  } catch (err) {
    next(err);
  }
};

// ─── Messages ───────────────────────────────────────────

export const listMessagesAdmin = async (req, res, next) => {
  try {
    const filter = req.query.filter === 'unread' ? 'unread' : 'all';
    const [messages, unread, total] = await Promise.all([
      listMessages({ unreadOnly: filter === 'unread' }),
      countMessages(true),
      countMessages(false),
    ]);
    return res.json({ messages, unread, total, filter });
  } catch (err) {
    next(err);
  }
};

export const getMessageAdmin = async (req, res, next) => {
  try {
    const message = await findMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found.', code: 'NOT_FOUND' });

    if (!message.is_read) {
      await setMessageRead(message.id, true);
      message.is_read = 1;
      clearCountsCache();
    }
    return res.json({ message });
  } catch (err) {
    next(err);
  }
};

export const toggleMessageReadAdmin = async (req, res, next) => {
  try {
    const message = await findMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found.', code: 'NOT_FOUND' });

    const target = req.body?.is_read !== undefined ? Boolean(req.body.is_read) : !message.is_read;
    await setMessageRead(message.id, target);
    clearCountsCache();

    return res.json({ ok: true, is_read: target ? 1 : 0 });
  } catch (err) {
    next(err);
  }
};

// ─── Subscribers ────────────────────────────────────────

export const listSubscribersAdmin = async (req, res, next) => {
  try {
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const [rows, active, total] = await Promise.all([
      listSubscribers(activeOnly),
      countSubscribers(true),
      countSubscribers(false),
    ]);
    return res.json({ subscribers: rows, active, total });
  } catch (err) {
    next(err);
  }
};

export const exportSubscribersCsvAdmin = async (req, res, next) => {
  try {
    const rows = await exportActiveSubscribers();
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['email,subscribed_at'];
    for (const r of rows) {
      const dt = r.subscribed_at ? new Date(r.subscribed_at).toISOString() : '';
      lines.push(`${escape(r.email)},${escape(dt)}`);
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="iavmn-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};