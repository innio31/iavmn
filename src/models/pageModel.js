// src/models/pageModel.js
// Data access for the pages table.

import { query } from '../db.js';

/**
 * List all pages.
 * @param {boolean} publishedOnly  If true, only is_published = 1 (public site).
 */
export const listPages = async (publishedOnly = false) => {
  const sql = publishedOnly
    ? 'SELECT * FROM `pages` WHERE `is_published` = 1 ORDER BY `title` ASC'
    : 'SELECT * FROM `pages` ORDER BY `updated_at` DESC';
  return query(sql);
};

/**
 * List published pages that should appear in the main menu.
 * Ordered by menu_order, then title.
 */
export const listPagesInMenu = async () => {
  return query(
    'SELECT `id`, `slug`, `title`, `menu_label` FROM `pages` WHERE `is_published` = 1 AND `show_in_menu` = 1 ORDER BY `menu_order` ASC, `title` ASC'
  );
};

/**
 * Find a page by id.
 */
export const findPageById = async (id) => {
  const rows = await query('SELECT * FROM `pages` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Find a page by slug (for public URLs).
 * @param {string} slug
 * @param {boolean} publishedOnly  If true, only returns published pages.
 */
export const findPageBySlug = async (slug, publishedOnly = false) => {
  const sql = publishedOnly
    ? 'SELECT * FROM `pages` WHERE `slug` = ? AND `is_published` = 1 LIMIT 1'
    : 'SELECT * FROM `pages` WHERE `slug` = ? LIMIT 1';
  const rows = await query(sql, [slug]);
  return rows.length ? rows[0] : null;
};

/**
 * Check if a slug exists (optionally excluding an id).
 */
export const slugExists = async (slug, excludeId = null) => {
  const sql = excludeId
    ? 'SELECT `id` FROM `pages` WHERE `slug` = ? AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `pages` WHERE `slug` = ? LIMIT 1';
  const params = excludeId ? [slug, excludeId] : [slug];
  const rows = await query(sql, params);
  return rows.length > 0;
};

/**
 * Create a page.
 */
export const createPage = async ({
  slug,
  title,
  content,
  meta_title,
  meta_description,
  is_published = 1,
  show_in_menu = 0,
  menu_label = null,
  menu_order = 0,
}) => {
  const result = await query(
    `INSERT INTO \`pages\`
       (\`slug\`, \`title\`, \`content\`, \`meta_title\`, \`meta_description\`, \`is_published\`, \`show_in_menu\`, \`menu_label\`, \`menu_order\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      title,
      content ?? null,
      meta_title ?? null,
      meta_description ?? null,
      is_published ? 1 : 0,
      show_in_menu ? 1 : 0,
      menu_label ?? null,
      Number(menu_order) || 0,
    ]
  );
  return result.insertId;
};

/**
 * Update a page.
 */
export const updatePage = async (id, {
  slug,
  title,
  content,
  meta_title,
  meta_description,
  is_published,
  show_in_menu,
  menu_label,
  menu_order,
}) => {
  await query(
    `UPDATE \`pages\` SET
       \`slug\` = ?,
       \`title\` = ?,
       \`content\` = ?,
       \`meta_title\` = ?,
       \`meta_description\` = ?,
       \`is_published\` = ?,
       \`show_in_menu\` = ?,
       \`menu_label\` = ?,
       \`menu_order\` = ?
     WHERE \`id\` = ?`,
    [
      slug,
      title,
      content ?? null,
      meta_title ?? null,
      meta_description ?? null,
      is_published ? 1 : 0,
      show_in_menu ? 1 : 0,
      menu_label ?? null,
      Number(menu_order) || 0,
      id,
    ]
  );
};

/**
 * Delete a page.
 */
export const deletePage = async (id) => {
  await query('DELETE FROM `pages` WHERE `id` = ?', [id]);
};

/**
 * Toggle is_published.
 */
export const togglePagePublished = async (id, isPublished) => {
  await query('UPDATE `pages` SET `is_published` = ? WHERE `id` = ?', [isPublished ? 1 : 0, id]);
};