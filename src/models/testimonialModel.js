// src/models/testimonialModel.js
// Data access for the testimonials table.

import { query } from '../db.js';

/**
 * List all testimonials.
 * @param {boolean} activeOnly  If true, only is_active = 1 (public site).
 */
export const listTestimonials = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT * FROM `testimonials` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `id` ASC'
    : 'SELECT * FROM `testimonials` ORDER BY `sort_order` ASC, `id` ASC';
  return query(sql);
};

/**
 * Find a testimonial by id.
 */
export const findTestimonialById = async (id) => {
  const rows = await query('SELECT * FROM `testimonials` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Create a testimonial.
 */
export const createTestimonial = async ({
  author_name,
  author_title,
  author_photo_path,
  quote,
  sort_order = 0,
  is_active = 1,
}) => {
  const result = await query(
    `INSERT INTO \`testimonials\`
       (\`author_name\`, \`author_title\`, \`author_photo_path\`, \`quote\`, \`sort_order\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      author_name,
      author_title ?? null,
      author_photo_path ?? null,
      quote,
      Number(sort_order) || 0,
      is_active ? 1 : 0,
    ]
  );
  return result.insertId;
};

/**
 * Update a testimonial.
 */
export const updateTestimonial = async (id, {
  author_name,
  author_title,
  author_photo_path,
  quote,
  sort_order,
  is_active,
}) => {
  await query(
    `UPDATE \`testimonials\` SET
       \`author_name\` = ?,
       \`author_title\` = ?,
       \`author_photo_path\` = ?,
       \`quote\` = ?,
       \`sort_order\` = ?,
       \`is_active\` = ?
     WHERE \`id\` = ?`,
    [
      author_name,
      author_title ?? null,
      author_photo_path ?? null,
      quote,
      Number(sort_order) || 0,
      is_active ? 1 : 0,
      id,
    ]
  );
};

/**
 * Delete a testimonial.
 */
export const deleteTestimonial = async (id) => {
  await query('DELETE FROM `testimonials` WHERE `id` = ?', [id]);
};

/**
 * Toggle is_active.
 */
export const toggleTestimonialActive = async (id, isActive) => {
  await query('UPDATE `testimonials` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};