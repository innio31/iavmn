// src/models/councilModel.js
// Data access for the council_members table.

import { query } from '../db.js';

/**
 * List all council members.
 * @param {boolean} activeOnly  If true, only is_active = 1 (public site).
 */
export const listMembers = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT * FROM `council_members` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `full_name` ASC'
    : 'SELECT * FROM `council_members` ORDER BY `sort_order` ASC, `full_name` ASC';
  return query(sql);
};

/**
 * Find a single member by id.
 */
export const findMemberById = async (id) => {
  const rows = await query('SELECT * FROM `council_members` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Find a single member by slug (for public profile URL).
 */
export const findMemberBySlug = async (slug) => {
  const rows = await query(
    'SELECT * FROM `council_members` WHERE `slug` = ? AND `is_active` = 1 LIMIT 1',
    [slug]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Check whether a slug is already used (optionally excluding a specific id).
 */
export const slugExists = async (slug, excludeId = null) => {
  const sql = excludeId
    ? 'SELECT `id` FROM `council_members` WHERE `slug` = ? AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `council_members` WHERE `slug` = ? LIMIT 1';
  const params = excludeId ? [slug, excludeId] : [slug];
  const rows = await query(sql, params);
  return rows.length > 0;
};

/**
 * Create a new member.
 */
export const createMember = async ({
  slug,
  full_name,
  job_title,
  bio_short,
  bio_full,
  photo_path,
  email,
  linkedin_url,
  sort_order = 0,
  is_active = 1,
}) => {
  const result = await query(
    `INSERT INTO \`council_members\`
      (\`slug\`, \`full_name\`, \`job_title\`, \`bio_short\`, \`bio_full\`, \`photo_path\`, \`email\`, \`linkedin_url\`, \`sort_order\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      full_name,
      job_title ?? null,
      bio_short ?? null,
      bio_full ?? null,
      photo_path ?? null,
      email ?? null,
      linkedin_url ?? null,
      Number(sort_order) || 0,
      is_active ? 1 : 0,
    ]
  );
  return result.insertId;
};

/**
 * Update an existing member.
 */
export const updateMember = async (id, {
  slug,
  full_name,
  job_title,
  bio_short,
  bio_full,
  photo_path,
  email,
  linkedin_url,
  sort_order,
  is_active,
}) => {
  await query(
    `UPDATE \`council_members\` SET
       \`slug\` = ?,
       \`full_name\` = ?,
       \`job_title\` = ?,
       \`bio_short\` = ?,
       \`bio_full\` = ?,
       \`photo_path\` = ?,
       \`email\` = ?,
       \`linkedin_url\` = ?,
       \`sort_order\` = ?,
       \`is_active\` = ?
     WHERE \`id\` = ?`,
    [
      slug,
      full_name,
      job_title ?? null,
      bio_short ?? null,
      bio_full ?? null,
      photo_path ?? null,
      email ?? null,
      linkedin_url ?? null,
      Number(sort_order) || 0,
      is_active ? 1 : 0,
      id,
    ]
  );
};

/**
 * Delete a member.
 */
export const deleteMember = async (id) => {
  await query('DELETE FROM `council_members` WHERE `id` = ?', [id]);
};

/**
 * Toggle is_active.
 */
export const toggleMemberActive = async (id, isActive) => {
  await query('UPDATE `council_members` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};