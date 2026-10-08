// src/models/applicationModel.js
// Data access for the membership_applications table.

import crypto from 'node:crypto';
import { query } from '../db.js';

/**
 * Generate a unique application reference like IAVMN-2026-0001.
 * Uses current year + padded sequence based on existing count for that year.
 * Falls back to a random suffix on collision.
 */
export const generateReference = async () => {
  const year = new Date().getFullYear();
  const prefix = `IAVMN-${year}-`;

  // Count existing applications for this year
  const rows = await query(
    "SELECT COUNT(*) AS n FROM `membership_applications` WHERE `reference` LIKE ?",
    [`${prefix}%`]
  );
  const next = Number(rows[0].n) + 1;

  // Try sequential; if collision, add a random suffix
  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = String(next + attempt).padStart(4, '0');
    const ref = `${prefix}${seq}`;
    const exists = await query(
      'SELECT `id` FROM `membership_applications` WHERE `reference` = ? LIMIT 1',
      [ref]
    );
    if (!exists.length) return ref;
  }

  // Fallback: append random hex
  return `${prefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

/**
 * List applications.
 * @param {object} opts
 * @param {string} opts.status         Optional: 'submitted' | 'under_review' | 'approved' | 'rejected'
 * @param {string} opts.paymentStatus  Optional: 'pending' | 'paid' | 'failed' | 'refunded'
 * @param {number} opts.limit
 * @param {number} opts.offset
 */
export const listApplications = async (opts = {}) => {
  const { status = null, paymentStatus = null, limit = null, offset = 0 } = opts;

  let sql = `
    SELECT a.*, t.name AS tier_name, t.slug AS tier_slug, t.currency AS tier_currency
    FROM membership_applications a
    LEFT JOIN membership_tiers t ON t.id = a.tier_id
  `;
  const where = [];
  const params = [];

  if (status) {
    where.push('a.`status` = ?');
    params.push(status);
  }
  if (paymentStatus) {
    where.push('a.`payment_status` = ?');
    params.push(paymentStatus);
  }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY a.`created_at` DESC';

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
 * Count applications by filters.
 */
export const countApplications = async (opts = {}) => {
  const { status = null, paymentStatus = null } = opts;

  let sql = 'SELECT COUNT(*) AS n FROM `membership_applications`';
  const where = [];
  const params = [];

  if (status) {
    where.push('`status` = ?');
    params.push(status);
  }
  if (paymentStatus) {
    where.push('`payment_status` = ?');
    params.push(paymentStatus);
  }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');

  const rows = await query(sql, params);
  return Number(rows[0].n);
};

/**
 * Find an application by id (with tier name).
 */
export const findApplicationById = async (id) => {
  const rows = await query(
    `SELECT a.*, t.name AS tier_name, t.slug AS tier_slug, t.currency AS tier_currency, t.fee_amount AS tier_fee
     FROM membership_applications a
     LEFT JOIN membership_tiers t ON t.id = a.tier_id
     WHERE a.id = ? LIMIT 1`,
    [id]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find an application by reference (used for Paystack callbacks).
 */
export const findApplicationByReference = async (reference) => {
  const rows = await query(
    `SELECT a.*, t.name AS tier_name, t.slug AS tier_slug, t.currency AS tier_currency, t.fee_amount AS tier_fee
     FROM membership_applications a
     LEFT JOIN membership_tiers t ON t.id = a.tier_id
     WHERE a.reference = ? LIMIT 1`,
    [reference]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find an application by email (case-insensitive).
 * Useful for checking duplicate submissions.
 */
export const findApplicationsByEmail = async (email) => {
  return query(
    'SELECT * FROM `membership_applications` WHERE LOWER(`email`) = LOWER(?) ORDER BY `created_at` DESC',
    [email]
  );
};

/**
 * Create an application.
 */
export const createApplication = async ({
  reference,
  tier_id,
  full_name,
  email,
  phone,
  address,
  employer,
  qualifications,
  years_experience,
  cv_path,
  photo_path,
}) => {
  const result = await query(
    `INSERT INTO \`membership_applications\`
       (\`reference\`, \`tier_id\`, \`full_name\`, \`email\`, \`phone\`, \`address\`, \`employer\`, \`qualifications\`, \`years_experience\`, \`cv_path\`, \`photo_path\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reference,
      tier_id,
      full_name,
      email,
      phone ?? null,
      address ?? null,
      employer ?? null,
      qualifications ?? null,
      years_experience ?? null,
      cv_path ?? null,
      photo_path ?? null,
    ]
  );
  return result.insertId;
};

/**
 * Update payment fields after a Paystack event.
 */
export const updateApplicationPayment = async (id, {
  payment_status,
  payment_reference,
  payment_amount,
  payment_currency,
  payment_paid_at,
}) => {
  await query(
    `UPDATE \`membership_applications\` SET
       \`payment_status\` = ?,
       \`payment_reference\` = ?,
       \`payment_amount\` = ?,
       \`payment_currency\` = ?,
       \`payment_paid_at\` = ?
     WHERE \`id\` = ?`,
    [
      payment_status,
      payment_reference ?? null,
      payment_amount ?? null,
      payment_currency ?? null,
      payment_paid_at ?? null,
      id,
    ]
  );
};

/**
 * Update application status (admin action).
 */
export const updateApplicationStatus = async (id, status, admin_notes = null) => {
  await query(
    'UPDATE `membership_applications` SET `status` = ?, `admin_notes` = ? WHERE `id` = ?',
    [status, admin_notes ?? null, id]
  );
};

/**
 * Delete an application.
 */
export const deleteApplication = async (id) => {
  await query('DELETE FROM `membership_applications` WHERE `id` = ?', [id]);
};

/**
 * Counts for admin dashboard badges.
 */
export const getApplicationCounts = async () => {
  const rows = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
      SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) AS under_review,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid
    FROM membership_applications
  `);
  const r = rows[0] || {};
  return {
    total: Number(r.total || 0),
    submitted: Number(r.submitted || 0),
    under_review: Number(r.under_review || 0),
    approved: Number(r.approved || 0),
    rejected: Number(r.rejected || 0),
    paid: Number(r.paid || 0),
  };
};