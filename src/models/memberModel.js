// src/models/memberModel.js
// Data access for the members table.

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { query } from '../db.js';

const SALT_ROUNDS = 12;

// ─── Member number generation ───────────────────────────

/**
 * Generate a unique member number like IAVMN/MEM/2026/0001.
 * Sequence resets yearly.
 */
export const generateMemberNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `IAVMN/MEM/${year}/`;

  const rows = await query(
    'SELECT COUNT(*) AS n FROM `members` WHERE `member_number` LIKE ?',
    [`${prefix}%`]
  );
  const next = Number(rows[0].n) + 1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = String(next + attempt).padStart(4, '0');
    const num = `${prefix}${seq}`;
    const exists = await query(
      'SELECT `id` FROM `members` WHERE `member_number` = ? LIMIT 1',
      [num]
    );
    if (!exists.length) return num;
  }

  // Fallback
  return `${prefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

// ─── Lookups ────────────────────────────────────────────

/**
 * Find a member by id (with tier name joined).
 */
export const findMemberById = async (id) => {
  const rows = await query(
    `SELECT m.*, t.name AS tier_name, t.slug AS tier_slug, t.currency AS tier_currency, t.fee_amount AS tier_fee
     FROM members m
     LEFT JOIN membership_tiers t ON t.id = m.tier_id
     WHERE m.id = ? LIMIT 1`,
    [id]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find a member by email (case-insensitive).
 */
export const findMemberByEmail = async (email) => {
  const rows = await query(
    `SELECT m.*, t.name AS tier_name, t.slug AS tier_slug, t.currency AS tier_currency, t.fee_amount AS tier_fee
     FROM members m
     LEFT JOIN membership_tiers t ON t.id = m.tier_id
     WHERE LOWER(m.email) = LOWER(?) LIMIT 1`,
    [email]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find a member by member_number (for public verification).
 */
export const findMemberByNumber = async (memberNumber) => {
  const rows = await query(
    `SELECT m.*, t.name AS tier_name, t.slug AS tier_slug
     FROM members m
     LEFT JOIN membership_tiers t ON t.id = m.tier_id
     WHERE m.member_number = ? LIMIT 1`,
    [memberNumber]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find by reset token (used for password reset).
 */
export const findMemberByResetToken = async (token) => {
  const rows = await query(
    'SELECT * FROM `members` WHERE `reset_token` = ? LIMIT 1',
    [token]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find a member by the application id it was created from.
 */
export const findMemberByApplicationId = async (applicationId) => {
  const rows = await query(
    'SELECT * FROM `members` WHERE `application_id` = ? LIMIT 1',
    [applicationId]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Check email uniqueness (excluding a member id).
 */
export const emailExists = async (email, excludeId = null) => {
  const sql = excludeId
    ? 'SELECT `id` FROM `members` WHERE LOWER(`email`) = LOWER(?) AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `members` WHERE LOWER(`email`) = LOWER(?) LIMIT 1';
  const params = excludeId ? [email, excludeId] : [email];
  const rows = await query(sql, params);
  return rows.length > 0;
};

// ─── Creation ───────────────────────────────────────────

/**
 * Create a member from an approved application.
 * Password is initially null; the member sets it via a welcome email link.
 *
 * @param {object} application  Full application row from applicationModel.
 * @param {number} monthsValid  How many months the membership is valid for.
 * @returns {Promise<number>} new member id
 */
export const createMemberFromApplication = async (application, monthsValid = 12) => {
  const memberNumber = await generateMemberNumber();

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + monthsValid);

  const result = await query(
    `INSERT INTO \`members\`
      (\`member_number\`, \`application_id\`, \`tier_id\`, \`full_name\`, \`email\`, \`phone\`, \`address\`, \`employer\`, \`qualifications\`, \`years_experience\`, \`photo_path\`, \`status\`, \`expires_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      memberNumber,
      application.id,
      application.tier_id,
      application.full_name,
      application.email,
      application.phone ?? null,
      application.address ?? null,
      application.employer ?? null,
      application.qualifications ?? null,
      application.years_experience ?? null,
      application.photo_path ?? null,
      expiresAt,
    ]
  );

  return result.insertId;
};

// ─── Updates ────────────────────────────────────────────

/**
 * Update member profile fields (member-editable).
 */
export const updateMemberProfile = async (id, {
  full_name,
  phone,
  address,
  employer,
  qualifications,
  years_experience,
}) => {
  await query(
    `UPDATE \`members\` SET
       \`full_name\` = ?,
       \`phone\` = ?,
       \`address\` = ?,
       \`employer\` = ?,
       \`qualifications\` = ?,
       \`years_experience\` = ?
     WHERE \`id\` = ?`,
    [
      full_name,
      phone ?? null,
      address ?? null,
      employer ?? null,
      qualifications ?? null,
      years_experience ?? null,
      id,
    ]
  );
};

/**
 * Update admin-controlled fields.
 */
export const updateMemberAdmin = async (id, {
  tier_id,
  status,
  expires_at,
  notes,
}) => {
  await query(
    `UPDATE \`members\` SET
       \`tier_id\` = ?,
       \`status\` = ?,
       \`expires_at\` = ?,
       \`notes\` = ?
     WHERE \`id\` = ?`,
    [tier_id, status, expires_at ?? null, notes ?? null, id]
  );
};

/**
 * Update status.
 */
export const setMemberStatus = async (id, status) => {
  await query('UPDATE `members` SET `status` = ? WHERE `id` = ?', [status, id]);
};

// ─── Password ───────────────────────────────────────────

/**
 * Set a member's password (hashed). Also marks them as verified.
 */
export const setMemberPassword = async (id, plainPassword) => {
  const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  await query(
    'UPDATE `members` SET `password_hash` = ?, `is_verified` = 1, `verified_at` = NOW(), `reset_token` = NULL, `reset_expires_at` = NULL WHERE `id` = ?',
    [hash, id]
  );
};

/**
 * Verify a plaintext password against a member's stored hash.
 */
export const verifyMemberPassword = async (plain, hash) => {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
};

/**
 * Update last_login_at.
 */
export const touchMemberLastLogin = async (id) => {
  await query('UPDATE `members` SET `last_login_at` = NOW() WHERE `id` = ?', [id]);
};

// ─── Password reset tokens ──────────────────────────────

/**
 * Generate a password reset token, valid for N minutes.
 * @returns {Promise<string>} token
 */
export const generateResetToken = async (id, minutesValid = 60) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + minutesValid * 60 * 1000);
  await query(
    'UPDATE `members` SET `reset_token` = ?, `reset_expires_at` = ? WHERE `id` = ?',
    [token, expires, id]
  );
  return token;
};

/**
 * Clear any pending reset token.
 */
export const clearResetToken = async (id) => {
  await query(
    'UPDATE `members` SET `reset_token` = NULL, `reset_expires_at` = NULL WHERE `id` = ?',
    [id]
  );
};

// ─── Admin listing ──────────────────────────────────────

/**
 * List members with optional filters.
 */
export const listMembers = async (opts = {}) => {
  const { status = null, tierId = null, limit = null, offset = 0 } = opts;

  let sql = `
    SELECT m.*, t.name AS tier_name, t.slug AS tier_slug
    FROM members m
    LEFT JOIN membership_tiers t ON t.id = m.tier_id
  `;
  const where = [];
  const params = [];

  if (status) {
    where.push('m.`status` = ?');
    params.push(status);
  }
  if (tierId) {
    where.push('m.`tier_id` = ?');
    params.push(tierId);
  }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY m.`created_at` DESC';

  if (limit && Number.isFinite(Number(limit))) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
    if (offset) {
      sql += ' OFFSET ?';
      params.push(Number(offset));
    }
  }

  return query(sql, params);
};

/**
 * Count members.
 */
export const countMembers = async (opts = {}) => {
  const { status = null } = opts;

  let sql = 'SELECT COUNT(*) AS n FROM `members`';
  const params = [];
  if (status) {
    sql += ' WHERE `status` = ?';
    params.push(status);
  }
  const rows = await query(sql, params);
  return Number(rows[0].n);
};

/**
 * Counts for admin dashboard tiles.
 */
export const getMemberCounts = async () => {
  const rows = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
      SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) AS verified
    FROM members
  `);
  const r = rows[0] || {};
  return {
    total: Number(r.total || 0),
    active: Number(r.active || 0),
    pending: Number(r.pending || 0),
    expired: Number(r.expired || 0),
    suspended: Number(r.suspended || 0),
    verified: Number(r.verified || 0),
  };
};

/**
 * Delete a member.
 */
export const deleteMember = async (id) => {
  await query('DELETE FROM `members` WHERE `id` = ?', [id]);
};