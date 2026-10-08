// src/models/contactModel.js
// Data access for the contact_messages table.

import { query } from '../db.js';

/**
 * List contact messages.
 * @param {object} opts
 * @param {boolean} opts.unreadOnly  If true, only unread messages.
 * @param {number}  opts.limit       Optional max rows.
 */
export const listMessages = async (opts = {}) => {
  const { unreadOnly = false, limit = null } = opts;
  let sql = 'SELECT * FROM `contact_messages`';
  const params = [];

  if (unreadOnly) sql += ' WHERE `is_read` = 0';
  sql += ' ORDER BY `created_at` DESC';

  if (limit && Number.isFinite(Number(limit))) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
  }

  return query(sql, params);
};

/**
 * Count messages.
 * @param {boolean} unreadOnly
 */
export const countMessages = async (unreadOnly = false) => {
  const sql = unreadOnly
    ? 'SELECT COUNT(*) AS n FROM `contact_messages` WHERE `is_read` = 0'
    : 'SELECT COUNT(*) AS n FROM `contact_messages`';
  const rows = await query(sql);
  return Number(rows[0].n);
};

/**
 * Find a message by id.
 */
export const findMessageById = async (id) => {
  const rows = await query('SELECT * FROM `contact_messages` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Create a contact message.
 */
export const createMessage = async ({ name, email, phone, subject, message }) => {
  const result = await query(
    'INSERT INTO `contact_messages` (`name`, `email`, `phone`, `subject`, `message`) VALUES (?, ?, ?, ?, ?)',
    [
      name,
      email,
      phone ?? null,
      subject ?? null,
      message,
    ]
  );
  return result.insertId;
};

/**
 * Mark a message as read (or unread).
 */
export const setMessageRead = async (id, isRead) => {
  await query('UPDATE `contact_messages` SET `is_read` = ? WHERE `id` = ?', [isRead ? 1 : 0, id]);
};

/**
 * Delete a message.
 */
export const deleteMessage = async (id) => {
  await query('DELETE FROM `contact_messages` WHERE `id` = ?', [id]);
};

/**
 * Mark all unread messages as read. Used by the "Mark all as read" action.
 */
export const markAllAsRead = async () => {
  await query('UPDATE `contact_messages` SET `is_read` = 1 WHERE `is_read` = 0');
};