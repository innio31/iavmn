// src/models/userModel.js
// Data access for the users table (admin accounts).

import bcrypt from 'bcrypt';
import { query } from '../db.js';

const SALT_ROUNDS = 12;

/**
 * Count total users. Used by the /setup guard.
 */
export const countUsers = async () => {
  const rows = await query('SELECT COUNT(*) AS n FROM `users`');
  return Number(rows[0].n);
};

/**
 * Find a user by id.
 */
export const findUserById = async (id) => {
  const rows = await query('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Find a user by email (case-insensitive).
 */
export const findUserByEmail = async (email) => {
  const rows = await query(
    'SELECT * FROM `users` WHERE LOWER(`email`) = LOWER(?) LIMIT 1',
    [email]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Check whether an email exists (optionally excluding an id).
 */
export const emailExists = async (email, excludeId = null) => {
  const sql = excludeId
    ? 'SELECT `id` FROM `users` WHERE LOWER(`email`) = LOWER(?) AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `users` WHERE LOWER(`email`) = LOWER(?) LIMIT 1';
  const params = excludeId ? [email, excludeId] : [email];
  const rows = await query(sql, params);
  return rows.length > 0;
};

/**
 * List all users (for the admin Users page). Excludes password_hash.
 */
export const listUsers = async () => {
  return query(
    'SELECT `id`, `name`, `email`, `role`, `is_active`, `last_login_at`, `created_at` FROM `users` ORDER BY `created_at` DESC'
  );
};

/**
 * Count active users with the super_admin role.
 * Used to prevent disabling/demoting the last super admin.
 */
export const countActiveSuperAdmins = async (excludeId = null) => {
  const sql = excludeId
    ? "SELECT COUNT(*) AS n FROM `users` WHERE `role` = 'super_admin' AND `is_active` = 1 AND `id` <> ?"
    : "SELECT COUNT(*) AS n FROM `users` WHERE `role` = 'super_admin' AND `is_active` = 1";
  const params = excludeId ? [excludeId] : [];
  const rows = await query(sql, params);
  return Number(rows[0].n);
};

/**
 * Create a new user. Hashes the password before insert.
 * @returns {number} new user id
 */
export const createUser = async ({ name, email, password, role = 'editor', is_active = 1 }) => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query(
    'INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `is_active`) VALUES (?, ?, ?, ?, ?)',
    [name, email, hash, role, is_active ? 1 : 0]
  );
  return result.insertId;
};

/**
 * Update a user's profile fields (name, email, role, is_active).
 */
export const updateUser = async (id, { name, email, role, is_active }) => {
  await query(
    'UPDATE `users` SET `name` = ?, `email` = ?, `role` = ?, `is_active` = ? WHERE `id` = ?',
    [name, email, role, is_active ? 1 : 0, id]
  );
};

/**
 * Update a user's password (hashes it first).
 */
export const updatePassword = async (id, newPassword) => {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query('UPDATE `users` SET `password_hash` = ? WHERE `id` = ?', [hash, id]);
};

/**
 * Soft-disable a user (safer than delete).
 */
export const setUserActive = async (id, isActive) => {
  await query('UPDATE `users` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};

/**
 * Hard delete a user. Use sparingly.
 */
export const deleteUser = async (id) => {
  await query('DELETE FROM `users` WHERE `id` = ?', [id]);
};

/**
 * Verify a plaintext password against a user's stored hash.
 */
export const verifyPassword = async (plain, hash) => {
  return bcrypt.compare(plain, hash);
};

/**
 * Update last_login_at to NOW().
 */
export const touchLastLogin = async (id) => {
  await query('UPDATE `users` SET `last_login_at` = NOW() WHERE `id` = ?', [id]);
};