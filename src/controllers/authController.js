// src/controllers/authController.js
// Handles: one-time setup, login, logout.
// Never touches the DB directly — always goes through userModel.

import { body, validationResult } from 'express-validator';
import {
  countUsers,
  createUser,
  findUserByEmail,
  verifyPassword,
  touchLastLogin,
} from '../models/userModel.js';

// ─── Setup (one-time, only when zero users exist) ───────

export const showSetup = async (req, res) => {
  const n = await countUsers();
  if (n > 0) {
    return res.status(404).render('errors/404', { title: 'Page Not Found' });
  }
  res.render('auth/setup', {
    title: 'Initial Setup',
    form: { name: '', email: '' },
    errors: [],
  });
};

export const setupValidators = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .isLength({ max: 180 })
    .withMessage('Email is too long.'),
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be at least 8 characters.'),
  body('password_confirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

export const postSetup = async (req, res) => {
  const n = await countUsers();
  if (n > 0) {
    return res.status(404).render('errors/404', { title: 'Page Not Found' });
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('auth/setup', {
      title: 'Initial Setup',
      form: { name: req.body.name || '', email: req.body.email || '' },
      errors: result.array(),
    });
  }

  const { name, email, password } = req.body;
  const id = await createUser({ name, email, password, role: 'super_admin' });

  req.session.user = {
    user_id: id,
    name,
    email,
    role_name: 'super_admin',
  };

  req.flash('success', 'Setup complete. Welcome!');
  return res.redirect('/admin');
};

// ─── Login ──────────────────────────────────────────────

export const showLogin = (req, res) => {
  const next = typeof req.query.next === 'string' ? req.query.next : '';
  res.render('auth/login', {
    title: 'Admin Login',
    form: { email: '' },
    errors: [],
    next,
  });
};

export const loginValidators = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required.'),
];

export const postLogin = async (req, res) => {
  const result = validationResult(req);
  const next = typeof req.body.next === 'string' ? req.body.next : '';

  if (!result.isEmpty()) {
    return res.status(422).render('auth/login', {
      title: 'Admin Login',
      form: { email: req.body.email || '' },
      errors: result.array(),
      next,
    });
  }

  const { email, password } = req.body;
  const user = await findUserByEmail(email);

  // Generic error message to avoid leaking which emails exist
  const invalid = () => {
    req.flash('error', 'Invalid email or password.');
    return res.status(422).render('auth/login', {
      title: 'Admin Login',
      form: { email },
      errors: [],
      next,
    });
  };

  if (!user) return invalid();
  if (!user.is_active) {
    req.flash('error', 'Your account has been disabled.');
    return res.status(403).render('auth/login', {
      title: 'Admin Login',
      form: { email },
      errors: [],
      next,
    });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return invalid();

  // Regenerate session to prevent fixation
  req.session.regenerate((err) => {
    if (err) {
      console.error('[login] session regenerate failed:', err);
      req.flash('error', 'Login failed. Please try again.');
      return res.redirect('/login');
    }

    req.session.user = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role_name: user.role,
    };

    touchLastLogin(user.id).catch((e) =>
      console.error('[login] touchLastLogin failed:', e.message)
    );

    req.flash('success', `Welcome back, ${user.name}.`);
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
    return res.redirect(safeNext);
  });
};

// ─── Logout ─────────────────────────────────────────────

export const postLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[logout] destroy failed:', err);
    res.clearCookie('iavmn.sid');
    return res.redirect('/login');
  });
};