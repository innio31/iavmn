// src/models/subscriberModel.js
// Data access for the subscribers table (newsletter).

import crypto from 'node:crypto';
import { query } from '../db.js';

/**
 * Generate a URL-safe unsubscribe token.
 */
const generateToken = () => crypto.randomBytes(24).toString('hex');

/**
 * List all subscribers.
 * @param {boolean} activeOnly  If true, only is_active = 1.
 */
export const listSubscribers = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT * FROM `subscribers` WHERE `is_active` = 1 ORDER BY `subscribed_at` DESC'
    : 'SELECT * FROM `subscribers` ORDER BY `subscribed_at` DESC';
  return query(sql);
};

/**
 * Count subscribers.
 * @param {boolean} activeOnly
 */
export const countSubscribers = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT COUNT(*) AS n FROM `subscribers` WHERE `is_active` = 1'
    : 'SELECT COUNT(*) AS n FROM `subscribers`';
  const rows = await query(sql);
  return Number(rows[0].n);
};

/**
 * Find a subscriber by email (case-insensitive).
 */
export const findSubscriberByEmail = async (email) => {
  const rows = await query(
    'SELECT * FROM `subscribers` WHERE LOWER(`email`) = LOWER(?) LIMIT 1',
    [email]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find a subscriber by id.
 */
export const findSubscriberById = async (id) => {
  const rows = await query('SELECT * FROM `subscribers` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Find a subscriber by unsubscribe token.
 */
export const findSubscriberByToken = async (token) => {
  const rows = await query('SELECT * FROM `subscribers` WHERE `unsub_token` = ? LIMIT 1', [token]);
  return rows.length ? rows[0] : null;
};

/**
 * Subscribe an email. If already exists and inactive, reactivates.
 * @returns {{ id: number, created: boolean, reactivated: boolean }}
 */
export const subscribe = async (email) => {
  const normalized = email.trim().toLowerCase();
  const existing = await findSubscriberByEmail(normalized);

  if (existing) {
    if (existing.is_active) {
      return { id: existing.id, created: false, reactivated: false };
    }
    await query('UPDATE `subscribers` SET `is_active` = 1 WHERE `id` = ?', [existing.id]);
    return { id: existing.id, created: false, reactivated: true };
  }

  const token = generateToken();
  const result = await query(
    'INSERT INTO `subscribers` (`email`, `is_active`, `unsub_token`) VALUES (?, 1, ?)',
    [normalized, token]
  );
  return { id: result.insertId, created: true, reactivated: false };
};

/**
 * Deactivate a subscriber by id (soft unsubscribe).
 */
export const unsubscribeById = async (id) => {
  await query('UPDATE `subscribers` SET `is_active` = 0 WHERE `id` = ?', [id]);
};

/**
 * Hard delete a subscriber.
 */
export const deleteSubscriber = async (id) => {
  await query('DELETE FROM `subscribers` WHERE `id` = ?', [id]);
};

/**
 * Toggle active state.
 */
export const toggleSubscriberActive = async (id, isActive) => {
  await query('UPDATE `subscribers` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};

/**
 * Export all active subscribers as an array of { email, subscribed_at }.
 * Used by the CSV export.
 */
export const exportActiveSubscribers = async () => {
  return query(
    'SELECT `email`, `subscribed_at` FROM `subscribers` WHERE `is_active` = 1 ORDER BY `subscribed_at` DESC'
  );
};