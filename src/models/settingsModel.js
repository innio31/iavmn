// src/models/settingsModel.js
// All DB access for the `settings` table. Controllers call these — never db.js directly.

import { query } from '../db.js';

/**
 * Get a single setting value by key.
 * Returns the value as a string, or null if not found.
 */
export const getSetting = async (key) => {
  const rows = await query('SELECT `value` FROM `settings` WHERE `key` = ? LIMIT 1', [key]);
  return rows.length ? rows[0].value : null;
};

/**
 * Get ALL settings as a flat object { key: value }.
 * Cached per-request by the middleware (see below).
 */
export const getAllSettings = async () => {
  const rows = await query('SELECT `key`, `value` FROM `settings`');
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
};

/**
 * Insert or update a setting.
 */
export const setSetting = async (key, value) => {
  await query(
    'INSERT INTO `settings` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value ?? null]
  );
};

/**
 * Set multiple settings at once (in a transaction).
 * @param {Object} entries  e.g. { site_name: 'IAVMN', contact_email: '...' }
 */
export const setManySettings = async (entries) => {
  const keys = Object.keys(entries);
  if (!keys.length) return;
  for (const key of keys) {
    await setSetting(key, entries[key]);
  }
};

/**
 * Delete a setting.
 */
export const deleteSetting = async (key) => {
  await query('DELETE FROM `settings` WHERE `key` = ?', [key]);
};