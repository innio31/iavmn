// src/controllers/adminPasswordResetController.js
// Password reset flow for admin users (forgot password → email → reset).

import { body, validationResult } from 'express-validator';
import crypto from 'node:crypto';
import { query } from '../db.js';
import {
  findUserByEmail,
  findUserById,
  updatePassword,
} from '../models/userModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { sendMail } from '../services/mailer.js';

// ─── Token storage helpers ──────────────────────────────
// We store reset tokens in the user_sessions table? No — too fragile.
// We use a dedicated approach: store the token on a new column on users,
// which requires a migration. To keep it simple without a schema change,
// we store tokens in a small in-memory + DB fallback:

// Simpler: use the existing `user_sessions` table? No.
// Best: add two columns to users — done via migration below.

const TOKEN_TTL_MINUTES = 60;

/**
 * Generate and store a reset token for the user.
 */
const createResetToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  await query(
    'UPDATE `users` SET `reset_token` = ?, `reset_expires_at` = ? WHERE `id` = ?',
    [token, expiresAt, userId]
  );
  return token;
};

/**
 * Find a user by reset token.
 */
const findUserByResetToken = async (token) => {
  const rows = await query(
    'SELECT * FROM `users` WHERE `reset_token` = ? LIMIT 1',
    [token]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Clear a reset token after use.
 */
const clearResetToken = async (userId) => {
  await query(
    'UPDATE `users` SET `reset_token` = NULL, `reset_expires_at` = NULL WHERE `id` = ?',
    [userId]
  );
};

// ─── Validation ─────────────────────────────────────────

export const forgotValidators = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address.'),
];

export const resetValidators = [
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be at least 8 characters.'),
  body('password_confirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

// ─── Forgot password ────────────────────────────────────

export const showForgotPassword = (req, res) => {
  res.render('auth/forgot-password', {
    layout: 'layouts/auth',
    title: 'Forgot Password',
    form: { email: '' },
    errors: [],
    sent: false,
  });
};

export const postForgotPassword = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('auth/forgot-password', {
      layout: 'layouts/auth',
      title: 'Forgot Password',
      form: { email: req.body.email || '' },
      errors: result.array(),
      sent: false,
    });
  }

  const email = req.body.email.trim().toLowerCase();
  const user = await findUserByEmail(email);

  // Always show the same "check your email" state — never reveal whether
  // an account exists (prevents user enumeration).
  if (user && user.is_active) {
    try {
      const token = await createResetToken(user.id);
      const settings = await getAllSettings();

      await sendMail({
        to: user.email,
        subject: 'Reset your IAVMN admin password',
        template: 'admin-password-reset',
        data: {
          user,
          token,
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });
    } catch (err) {
      console.error('[admin forgot password] mail failed:', err.message);
    }
  }

  res.render('auth/forgot-password', {
    layout: 'layouts/auth',
    title: 'Forgot Password',
    form: { email: '' },
    errors: [],
    sent: true,
  });
};

// ─── Reset password (from email) ────────────────────────

export const showResetPassword = async (req, res) => {
  const token = req.params.token;
  const user = await findUserByResetToken(token);

  if (!user || !user.reset_expires_at) {
    return res.status(404).render('errors/404', { title: 'Invalid or expired link' });
  }

  const expiresAt = new Date(user.reset_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await clearResetToken(user.id);
    return res.status(410).render('auth/reset-password-expired', {
      layout: 'layouts/auth',
      title: 'Link expired',
      email: user.email,
    });
  }

  res.render('auth/reset-password', {
    layout: 'layouts/auth',
    title: 'Reset Password',
    user,
    token,
    errors: [],
  });
};

export const postResetPassword = async (req, res) => {
  const token = req.params.token;
  const user = await findUserByResetToken(token);

  if (!user || !user.reset_expires_at) {
    return res.status(404).render('errors/404', { title: 'Invalid or expired link' });
  }

  const expiresAt = new Date(user.reset_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    await clearResetToken(user.id);
    return res.status(410).render('auth/reset-password-expired', {
      layout: 'layouts/auth',
      title: 'Link expired',
      email: user.email,
    });
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('auth/reset-password', {
      layout: 'layouts/auth',
      title: 'Reset Password',
      user,
      token,
      errors: result.array(),
    });
  }

  await updatePassword(user.id, req.body.password);
  await clearResetToken(user.id);

  req.flash('success', 'Your password has been reset. Please log in.');
  res.redirect('/login');
};