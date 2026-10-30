// src/controllers/apiMemberController.js
// Member API endpoints. Mirrors memberDashboardController logic but returns JSON.
// req.member is set by requireMemberJWT.

import {
  findMemberById,
  updateMemberProfile,
  verifyMemberPassword,
  setMemberPassword,
} from '../models/memberModel.js';
import { listApplications } from '../models/applicationModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { streamCertificate, generateQrBuffer } from '../services/certificate.js';
import { revokeAllForUser } from '../services/jwtService.js';

// ─── Helpers ────────────────────────────────────────────

const daysUntil = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const isStrongEnough = (pwd) => {
  if (typeof pwd !== 'string') return false;
  if (pwd.length < 8 || pwd.length > 100) return false;
  return /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
};

const serializeMember = (m) => {
  const daysLeft = daysUntil(m.expires_at);
  return {
    id: m.id,
    member_number: m.member_number,
    full_name: m.full_name,
    email: m.email,
    phone: m.phone,
    address: m.address,
    employer: m.employer,
    qualifications: m.qualifications,
    years_experience: m.years_experience,
    photo_path: m.photo_path,
    status: m.status,
    is_verified: m.is_verified,
    tier_id: m.tier_id,
    tier_name: m.tier_name || null,
    tier_slug: m.tier_slug || null,
    joined_at: m.joined_at,
    expires_at: m.expires_at,
    last_login_at: m.last_login_at,
    days_left: daysLeft,
    is_expiring_soon: daysLeft !== null && daysLeft > 0 && daysLeft <= 60,
    is_expired: daysLeft !== null && daysLeft <= 0,
    verification_url: `https://iavmn.org.ng/verify/${encodeURIComponent(m.member_number)}`,
  };
};

// ─── GET /api/v1/member/me ──────────────────────────────

export const getMe = async (req, res, next) => {
  try {
    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });
    return res.json({ member: serializeMember(member) });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/member/me ────────────────────────────

export const patchMe = async (req, res, next) => {
  try {
    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    const errors = {};
    const b = req.body || {};

    const fullName = typeof b.full_name === 'string' ? b.full_name.trim() : member.full_name;
    if (!fullName || fullName.length < 2 || fullName.length > 180) {
      errors.full_name = 'Full name must be between 2 and 180 characters.';
    }

    const phone = b.phone === undefined ? member.phone : String(b.phone || '').trim() || null;
    if (phone && phone.length > 40) errors.phone = 'Phone number is too long.';

    const address = b.address === undefined ? member.address : String(b.address || '').trim() || null;
    if (address && address.length > 300) errors.address = 'Address cannot exceed 300 characters.';

    const employer = b.employer === undefined ? member.employer : String(b.employer || '').trim() || null;
    if (employer && employer.length > 200) errors.employer = 'Employer cannot exceed 200 characters.';

    const qualifications =
      b.qualifications === undefined ? member.qualifications : String(b.qualifications || '').trim() || null;
    if (qualifications && qualifications.length > 2000) {
      errors.qualifications = 'Qualifications cannot exceed 2000 characters.';
    }

    let yearsExperience = member.years_experience;
    if (b.years_experience !== undefined) {
      const v = b.years_experience;
      if (v === '' || v === null) yearsExperience = null;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 80) {
          errors.years_experience = 'Years of experience must be between 0 and 80.';
        } else {
          yearsExperience = n;
        }
      }
    }

    if (Object.keys(errors).length) {
      return res.status(422).json({ error: 'Please correct the highlighted fields.', code: 'VALIDATION', errors });
    }

    await updateMemberProfile(member.id, {
      full_name: fullName,
      phone,
      address,
      employer,
      qualifications,
      years_experience: yearsExperience,
    });

    const updated = await findMemberById(member.id);
    return res.json({ member: serializeMember(updated) });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/member/change-password ────────────────

export const changePassword = async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(422).json({ error: 'currentPassword and newPassword are required.', code: 'VALIDATION' });
    }

    if (!isStrongEnough(newPassword)) {
      return res.status(422).json({
        error: 'Password must be at least 8 characters and contain at least one letter and one number.',
        code: 'WEAK_PASSWORD',
      });
    }

    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });
    if (!member.password_hash) {
      return res.status(400).json({ error: 'Account has no password set. Please reset via the website.', code: 'NO_PASSWORD' });
    }

    const ok = await verifyMemberPassword(currentPassword, member.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect.', code: 'INVALID_CURRENT_PASSWORD' });
    }

    if (currentPassword === newPassword) {
      return res.status(422).json({ error: 'New password must be different from the current password.', code: 'SAME_PASSWORD' });
    }

    await setMemberPassword(member.id, newPassword);

    // Revoke all refresh tokens so other devices must re-login.
    // (The current session will still work until its access token expires.)
    await revokeAllForUser('member', member.id);

    return res.json({ ok: true, message: 'Password updated. Please log in again on other devices.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/member/payments ────────────────────────

export const listPayments = async (req, res, next) => {
  try {
    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    // Same source as web showPayments: paid applications filtered by email.
    const allPaid = await listApplications({ paymentStatus: 'paid' });
    const mine = allPaid.filter(
      (a) => a.email && a.email.toLowerCase() === member.email.toLowerCase()
    );

    const payments = mine.map((a) => ({
      id: a.id,
      reference: a.reference,
      amount: Number(a.payment_amount || 0),
      currency: a.payment_currency || 'NGN',
      paid_at: a.payment_paid_at,
      payment_reference: a.payment_reference || null,
      tier_name: a.tier_name || null,
      tier_slug: a.tier_slug || null,
      status: a.payment_status,
      created_at: a.created_at,
    }));

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    return res.json({ payments, totalPaid, currency: payments[0]?.currency || 'NGN' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/member/certificate.pdf ─────────────────

export const downloadCertificate = async (req, res, next) => {
  try {
    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    if (member.status !== 'active') {
      return res.status(403).json({
        error: 'Your membership must be active to download a certificate.',
        code: 'MEMBERSHIP_INACTIVE',
      });
    }

    const settings = await getAllSettings();
    await streamCertificate(res, member, settings);
  } catch (err) {
    if (!res.headersSent) return next(err);
    // If streaming already started, just end the response.
    try { res.end(); } catch { /* ignore */ }
  }
};

// ─── GET /api/v1/member/certificate/qr.png ──────────────

export const getCertificateQr = async (req, res, next) => {
  try {
    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).json({ error: 'Member not found.', code: 'NOT_FOUND' });

    const settings = await getAllSettings();
    const png = await generateQrBuffer(member, settings, 400);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(png);
  } catch (err) {
    next(err);
  }
};