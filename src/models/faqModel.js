// src/models/faqModel.js
// Data access for the faqs table.

import { query } from '../db.js';

/**
 * List all FAQs.
 * @param {boolean} activeOnly  If true, only is_active = 1 (public site).
 */
export const listFaqs = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT * FROM `faqs` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `id` ASC'
    : 'SELECT * FROM `faqs` ORDER BY `sort_order` ASC, `id` ASC';
  return query(sql);
};

/**
 * Find a FAQ by id.
 */
export const findFaqById = async (id) => {
  const rows = await query('SELECT * FROM `faqs` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Create a FAQ.
 */
export const createFaq = async ({ question, answer, sort_order = 0, is_active = 1 }) => {
  const result = await query(
    'INSERT INTO `faqs` (`question`, `answer`, `sort_order`, `is_active`) VALUES (?, ?, ?, ?)',
    [question, answer, Number(sort_order) || 0, is_active ? 1 : 0]
  );
  return result.insertId;
};

/**
 * Update a FAQ.
 */
export const updateFaq = async (id, { question, answer, sort_order, is_active }) => {
  await query(
    'UPDATE `faqs` SET `question` = ?, `answer` = ?, `sort_order` = ?, `is_active` = ? WHERE `id` = ?',
    [question, answer, Number(sort_order) || 0, is_active ? 1 : 0, id]
  );
};

/**
 * Delete a FAQ.
 */
export const deleteFaq = async (id) => {
  await query('DELETE FROM `faqs` WHERE `id` = ?', [id]);
};

/**
 * Toggle is_active.
 */
export const toggleFaqActive = async (id, isActive) => {
  await query('UPDATE `faqs` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};