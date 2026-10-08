// src/models/heroModel.js
// Data access for the hero_slides table.

import { query } from '../db.js';

/**
 * List all slides ordered by sort_order.
 * @param {boolean} activeOnly  If true, only returns is_active = 1 (for public site).
 */
export const listSlides = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT * FROM `hero_slides` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `id` ASC'
    : 'SELECT * FROM `hero_slides` ORDER BY `sort_order` ASC, `id` ASC';
  return query(sql);
};

/**
 * Find a single slide by id.
 */
export const findSlideById = async (id) => {
  const rows = await query('SELECT * FROM `hero_slides` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Create a new slide.
 * @returns {number} new slide id
 */
export const createSlide = async ({
  title,
  subtitle,
  image_path,
  cta_text,
  cta_url,
  sort_order = 0,
  is_active = 1,
}) => {
  const result = await query(
    'INSERT INTO `hero_slides` (`title`, `subtitle`, `image_path`, `cta_text`, `cta_url`, `sort_order`, `is_active`) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      title,
      subtitle ?? null,
      image_path,
      cta_text ?? null,
      cta_url ?? null,
      sort_order,
      is_active ? 1 : 0,
    ]
  );
  return result.insertId;
};

/**
 * Update an existing slide.
 */
export const updateSlide = async (id, {
  title,
  subtitle,
  image_path,
  cta_text,
  cta_url,
  sort_order,
  is_active,
}) => {
  await query(
    'UPDATE `hero_slides` SET `title` = ?, `subtitle` = ?, `image_path` = ?, `cta_text` = ?, `cta_url` = ?, `sort_order` = ?, `is_active` = ? WHERE `id` = ?',
    [
      title,
      subtitle ?? null,
      image_path,
      cta_text ?? null,
      cta_url ?? null,
      Number(sort_order) || 0,
      is_active ? 1 : 0,
      id,
    ]
  );
};

/**
 * Delete a slide by id.
 */
export const deleteSlide = async (id) => {
  await query('DELETE FROM `hero_slides` WHERE `id` = ?', [id]);
};

/**
 * Toggle is_active.
 */
export const toggleSlideActive = async (id, isActive) => {
  await query('UPDATE `hero_slides` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};