// src/controllers/memberAuthController.js
// Member portal authentication: login, logout, set password, forgot/reset password.

import { body, validationResult } from 'express-validator';
import {
  findMemberByEmail,
  findMemberById,
  findMemberByResetToken,
  verifyMemberPassword,
  setMemberPassword,
  touchMemberLastLogin,
  generateResetToken,
  clearResetToken,
} from '../models/memberModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { sendMail } from '../services/mailer.js';

// ─── Password policy ────────────────────────────────────
// 8+ chars, at least 1 letter + 1 number.

const isStrongEnough = (pwd) => {
  if (typeof pwd !== 'string') return false;
  if (pwd.length < 8 || pwd.length > 100) return false;
  return /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
};

const passwordErrorMessage = 'Password must be at least 8 characters and contain at least one letter and one number.';

// ─── Validation ─────────────────────────────────────────

export const loginValidators = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address.'),
  body('password').isLength({ min: 1 }).withMessage('Password is required.'),
];

export const setPasswordValidators = [
  body('password')
    .custom((v) => isStrongEnough(v))
    .withMessage(passwordErrorMessage),
  body('password_confirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

export const forgotPasswordValidators = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address.'),
];

// ─── Login ──────────────────────────────────────────────

export const showMemberLogin = (req, res) => {
  const next = typeof req.query.next === 'string' ? req.query.next : '';
  res.render('members/auth/login', {
    layout: 'layouts/member',
    title: 'Member Login',
    form: { email: '' },
    errors: [],
    next,
  });
};

export const postMemberLogin = async (req, res) => {
  const result = validationResult(req);
  const next = typeof req.body.next === 'string' ? req.body.next : '';

  if (!result.isEmpty()) {
    return res.status(422).render('members/auth/login', {
      layout: 'layouts/member',
      title: 'Member Login',
      form: { email: req.body.email || '' },
      errors: result.array(),
      next,
    });
  }

  const { email, password } = req.body;
  const member = await findMemberByEmail(email);

  // Generic error to avoid email enumeration
  const invalid = () => {
    req.flash('error', 'Invalid email or password.');
    return res.status(422).render('members/auth/login', {
      layout: 'layouts/member',
      title: 'Member Login',
      form: { email },
      errors: [],
      next,
    });
  };

  if (!member) return invalid();

  // Member must have set a password (via welcome email) before logging in
  if (!member.password_hash) {
    req.flash('error', 'Your account is not yet activated. Check your email for the activation link, or use "Forgot password".');
    return res.status(403).render('members/auth/login', {
      layout: 'layouts/member',
      title: 'Member Login',
      form: { email },
      errors: [],
      next,
    });
  }

  if (member.status === 'suspended') {
    req.flash('error', 'Your membership has been suspended. Please contact the Institute.');
    return res.status(403).render('members/auth/login', {
      layout: 'layouts/member',
      title: 'Member Login',
      form: { email },
      errors: [],
      next,
    });
  }

  if (member.status === 'cancelled') {
    req.flash('error', 'Your membership has been cancelled.');
    return res.status(403).render('members/auth/login', {
      layout: 'layouts/member',
      title: 'Member Login',
      form: { email },
      errors: [],
      next,
    });
  }

  const ok = await verifyMemberPassword(password, member.password_hash);
  if (!ok) return invalid();

  // Regenerate session on login to prevent fixation
  req.session.regenerate((err) => {
    if (err) {
      console.error('[member login] regenerate failed:', err);
      req.flash('error', 'Login failed. Please try again.');
      return res.redirect('/member/login');
    }

    req.session.member = {
      id: member.id,
      email: member.email,
      member_number: member.member_number,
      full_name: member.full_name,
    };

    touchMemberLastLogin(member.id).catch((e) =>
      console.error('[member login] touchLastLogin failed:', e.message)
    );

    req.flash('success', `Welcome back, ${member.full_name.split(/\s+/)[0]}.`);
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/member';
    return res.redirect(safeNext);
  });
};

export const postMemberLogout = (req, res) => {
  if (req.session) {
    delete req.session.member;
  }
  req.flash('success', 'You have been logged out.');
  res.redirect('/member/login');
};

// ─── Set password (from welcome email) ──────────────────

export const showSetPassword = async (req, res) => {
  const token = req.params.token;
  const member = await findMemberByResetToken(token);

  if (!member || !member.reset_expires_at) {
    return res.status(404).render('errors/404', { title: 'Invalid or expired link' });
  }

  const expiresAt = new Date(member.reset_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    // Expired — clear it and show a friendly message
    await clearResetToken(member.id);
    return res.status(410).render('members/auth/set-password-expired', {
      layout: 'layouts/member',
      title: 'Link expired',
      email: member.email,
    });
  }

  res.render('members/auth/set-password', {
    layout: 'layouts/member',
    title: 'Set your password',
    member,
    token,
    form: {},
    errors: [],
  });
};

export const postSetPassword = async (req, res) => {
  const token = req.params.token;
  const member = await findMemberByResetToken(token);

  if (!member || !member.reset_expires_at) {
    return res.status(404).render('errors/404', { title: 'Invalid or expired link' });
  }

  const expiresAt = new Date(member.reset_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await clearResetToken(member.id);
    return res.status(410).render('members/auth/set-password-expired', {
      layout: 'layouts/member',
      title: 'Link expired',
      email: member.email,
    });
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('members/auth/set-password', {
      layout: 'layouts/member',
      title: 'Set your password',
      member,
      token,
      form: {},
      errors: result.array(),
    });
  }

  await setMemberPassword(member.id, req.body.password);

  req.flash('success', 'Your password has been set. You can now log in.');
  res.redirect('/member/login');
};

// ─── Forgot password ────────────────────────────────────

export const showForgotPassword = (req, res) => {
  res.render('members/auth/forgot-password', {
    layout: 'layouts/member',
    title: 'Forgot Password',
    form: { email: '' },
    errors: [],
    sent: false,
  });
};

export const postForgotPassword = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('members/auth/forgot-password', {
      layout: 'layouts/member',
      title: 'Forgot Password',
      form: { email: req.body.email || '' },
      errors: result.array(),
      sent: false,
    });
  }

  const email = req.body.email.trim().toLowerCase();
  const member = await findMemberByEmail(email);

  // Always show "check your email" — never reveal whether the email exists
  if (member && (member.status === 'active' || member.status === 'expired')) {
    try {
      const token = await generateResetToken(member.id, 60); // 1 hour
      const settings = await getAllSettings();

      await sendMail({
        to: member.email,
        subject: 'Reset your IAVMN password',
        template: 'member-password-reset',
        data: {
          member,
          token,
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });
    } catch (err) {
      console.error('[forgot password] mail failed:', err.message);
    }
  }

  res.render('members/auth/forgot-password', {
    layout: 'layouts/member',
    title: 'Forgot Password',
    form: { email: '' },
    errors: [],
    sent: true,
  });
};

// ─── Reset password (from reset email) ──────────────────

export const showResetPassword = async (req, res) => {
  const token = req.params.token;
  const member = await findMemberByResetToken(token);

  if (!member || !member.reset_expires_at) {
    return res.status(404).render('errors/404', { title: 'Invalid or expired link' });
  }

  const expiresAt = new Date(member.reset_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await clearResetToken(member.id);
    return res.status(410).render('members/auth/set-password-expired', {
      layout: 'layouts/member',
      title: 'Link expired',
      email: member.email,
    });
  }

  res.render('members/auth/reset-password', {
    layout: 'layouts/member',
    title: 'Reset your password',
    member,
    token,
    errors: [],
  });
};

export const postResetPassword = async (req, res) => {
  const token = req.params.token;
  const member = await findMemberByResetToken(token);

  if (!member || !member.reset_expires_at) {
    return res.status(404).render('errors/404', { title: 'Invalid or expired link' });
  }

  const expiresAt = new Date(member.reset_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await clearResetToken(member.id);
    return res.status(410).render('members/auth/set-password-expired', {
      layout: 'layouts/member',
      title: 'Link expired',
      email: member.email,
    });
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('members/auth/reset-password', {
      layout: 'layouts/member',
      title: 'Reset your password',
      member,
      token,
      errors: result.array(),
    });
  }

  await setMemberPassword(member.id, req.body.password);

  req.flash('success', 'Your password has been reset. Please log in.');
  res.redirect('/member/login');
};