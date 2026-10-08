// src/controllers/userController.js
// Admin: manage admin users (super_admin only).

import { body, validationResult } from 'express-validator';
import {
  listUsers,
  findUserById,
  findUserByEmail,
  emailExists,
  countActiveSuperAdmins,
  createUser,
  updateUser,
  updatePassword,
  setUserActive,
  deleteUser,
} from '../models/userModel.js';

const ROLES = ['super_admin', 'admin', 'editor', 'membership_officer'];

// ─── Validation ─────────────────────────────────────────

export const newUserValidators = [
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
  body('role')
    .isIn(ROLES)
    .withMessage('Please choose a valid role.'),
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be at least 8 characters.'),
  body('password_confirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

export const editUserValidators = [
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
  body('role')
    .isIn(ROLES)
    .withMessage('Please choose a valid role.'),
];

export const passwordChangeValidators = [
  body('new_password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be at least 8 characters.'),
  body('new_password_confirm')
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage('Passwords do not match.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listUsersAdmin = async (req, res) => {
  const users = await listUsers();
  const superAdminCount = await countActiveSuperAdmins();

  res.render('admin/users/list', {
    title: 'Admin Users',
    layout: 'layouts/admin',
    users,
    superAdminCount,
    currentUserId: req.session.user.user_id,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewUser = (req, res) => {
  res.render('admin/users/form', {
    title: 'New Admin User',
    layout: 'layouts/admin',
    user: { id: null, name: '', email: '', role: 'editor', is_active: 1 },
    errors: [],
    mode: 'new',
  });
};

export const postNewUser = async (req, res) => {
  const result = validationResult(req);

  // Check email uniqueness
  const duplicate = await emailExists(req.body.email.trim());

  if (!result.isEmpty() || duplicate) {
    const errs = result.isEmpty() ? [] : result.array();
    if (duplicate) errs.unshift({ msg: 'That email is already in use.' });

    return res.status(422).render('admin/users/form', {
      title: 'New Admin User',
      layout: 'layouts/admin',
      user: {
        id: null,
        name: req.body.name || '',
        email: req.body.email || '',
        role: req.body.role || 'editor',
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: errs,
      mode: 'new',
    });
  }

  const id = await createUser({
    name: req.body.name.trim(),
    email: req.body.email.trim().toLowerCase(),
    password: req.body.password,
    role: req.body.role,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'Admin user created.');
  res.redirect('/admin/users');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditUser = async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin/users');
  }
  res.render('admin/users/form', {
    title: 'Edit Admin User',
    layout: 'layouts/admin',
    user,
    errors: [],
    mode: 'edit',
    isSelf: req.session.user.user_id === user.id,
  });
};

export const postEditUser = async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin/users');
  }

  const isSelf = req.session.user.user_id === user.id;
  const result = validationResult(req);

  // Check email uniqueness (excluding self)
  const duplicate = await emailExists(req.body.email.trim(), user.id);

  // Guard: cannot demote the last active super_admin
  const newRole = req.body.role;
  const newIsActive = req.body.is_active ? 1 : 0;
  const wouldLoseLastSuperAdmin =
    user.role === 'super_admin' &&
    user.is_active === 1 &&
    (newRole !== 'super_admin' || newIsActive === 0) &&
    (await countActiveSuperAdmins(user.id)) === 0;

  // Guard: cannot disable yourself
  const wouldDisableSelf = isSelf && newIsActive === 0;

  // Guard: cannot demote yourself if you're a super_admin (avoid lockout)
  const wouldDemoteSelf = isSelf && user.role === 'super_admin' && newRole !== 'super_admin';

  const businessErrors = [];
  if (duplicate) businessErrors.push({ msg: 'That email is already in use.' });
  if (wouldLoseLastSuperAdmin) {
    businessErrors.push({ msg: 'Cannot demote or disable the last active super admin.' });
  }
  if (wouldDisableSelf) businessErrors.push({ msg: 'You cannot disable your own account.' });
  if (wouldDemoteSelf) businessErrors.push({ msg: 'You cannot demote your own super admin role.' });

  if (!result.isEmpty() || businessErrors.length) {
    const errs = [...businessErrors, ...(result.isEmpty() ? [] : result.array())];
    return res.status(422).render('admin/users/form', {
      title: 'Edit Admin User',
      layout: 'layouts/admin',
      user: {
        ...user,
        name: req.body.name || user.name,
        email: req.body.email || user.email,
        role: req.body.role || user.role,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: errs,
      mode: 'edit',
      isSelf,
    });
  }

  await updateUser(user.id, {
    name: req.body.name.trim(),
    email: req.body.email.trim().toLowerCase(),
    role: newRole,
    is_active: newIsActive,
  });

  // If editing yourself, refresh session fields
  if (isSelf) {
    req.session.user.name = req.body.name.trim();
    req.session.user.email = req.body.email.trim().toLowerCase();
    req.session.user.role_name = newRole;
  }

  req.flash('success', 'User updated.');
  res.redirect('/admin/users');
};

// ─── Admin: change password ─────────────────────────────

export const postChangePassword = async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin/users');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    req.flash('error', result.array()[0].msg);
    return res.redirect(`/admin/users/${user.id}/edit`);
  }

  await updatePassword(user.id, req.body.new_password);
  req.flash('success', `Password updated for ${user.name}.`);
  res.redirect(`/admin/users/${user.id}/edit`);
};

// ─── Admin: toggle active ───────────────────────────────

export const postToggleUser = async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin/users');
  }

  // Guard: cannot disable yourself
  if (user.id === req.session.user.user_id) {
    req.flash('error', 'You cannot disable your own account.');
    return res.redirect('/admin/users');
  }

  // Guard: cannot disable the last active super_admin
  if (
    user.role === 'super_admin' &&
    user.is_active === 1 &&
    (await countActiveSuperAdmins(user.id)) === 0
  ) {
    req.flash('error', 'Cannot disable the last active super admin.');
    return res.redirect('/admin/users');
  }

  await setUserActive(user.id, !user.is_active);
  req.flash('success', 'User status updated.');
  res.redirect('/admin/users');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteUser = async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin/users');
  }

  // Guard: cannot delete yourself
  if (user.id === req.session.user.user_id) {
    req.flash('error', 'You cannot delete your own account.');
    return res.redirect('/admin/users');
  }

  // Guard: cannot delete the last active super_admin
  if (
    user.role === 'super_admin' &&
    user.is_active === 1 &&
    (await countActiveSuperAdmins(user.id)) === 0
  ) {
    req.flash('error', 'Cannot delete the last active super admin.');
    return res.redirect('/admin/users');
  }

  await deleteUser(user.id);
  req.flash('success', 'User deleted.');
  res.redirect('/admin/users');
};