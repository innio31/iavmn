// src/models/tierModel.js
// Data access for the membership_tiers table.

import { query } from '../db.js';

/**
 * List all tiers.
 * @param {boolean} activeOnly  If true, only is_active = 1 (public site).
 */
export const listTiers = async (activeOnly = false) => {
  const sql = activeOnly
    ? 'SELECT * FROM `membership_tiers` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `id` ASC'
    : 'SELECT * FROM `membership_tiers` ORDER BY `sort_order` ASC, `id` ASC';
  return query(sql);
};

/**
 * Find a tier by id.
 */
export const findTierById = async (id) => {
  const rows = await query('SELECT * FROM `membership_tiers` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Find a tier by slug (for public URLs like /membership/student).
 */
export const findTierBySlug = async (slug) => {
  const rows = await query(
    'SELECT * FROM `membership_tiers` WHERE `slug` = ? AND `is_active` = 1 LIMIT 1',
    [slug]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Check whether a slug is already in use (optionally excluding an id).
 */
export const slugExists = async (slug, excludeId = null) => {
  const sql = excludeId
    ? 'SELECT `id` FROM `membership_tiers` WHERE `slug` = ? AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `membership_tiers` WHERE `slug` = ? LIMIT 1';
  const params = excludeId ? [slug, excludeId] : [slug];
  const rows = await query(sql, params);
  return rows.length > 0;
};

/**
 * Create a tier.
 */
export const createTier = async ({
  slug,
  name,
  short_description,
  description,
  icon,
  fee_amount,
  registration_fee,
  currency = 'NGN',
  sort_order = 0,
  is_active = 1,
}) => {
  const result = await query(
    `INSERT INTO \`membership_tiers\`
       (\`slug\`, \`name\`, \`short_description\`, \`description\`, \`icon\`, \`fee_amount\`, \`registration_fee\`, \`currency\`, \`sort_order\`, \`is_active\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      name,
      short_description ?? null,
      description ?? null,
      icon ?? null,
      Number(fee_amount) || 0,
      Number(registration_fee) || 0,
      currency || 'NGN',
      Number(sort_order) || 0,
      is_active ? 1 : 0,
    ]
  );
  return result.insertId;
};

/**
 * Update a tier.
 */
export const updateTier = async (id, {
  slug,
  name,
  short_description,
  description,
  icon,
  fee_amount,
  registration_fee,
  currency,
  sort_order,
  is_active,
}) => {
  await query(
    `UPDATE \`membership_tiers\` SET
       \`slug\` = ?,
       \`name\` = ?,
       \`short_description\` = ?,
       \`description\` = ?,
       \`icon\` = ?,
       \`fee_amount\` = ?,
       \`registration_fee\` = ?,
       \`currency\` = ?,
       \`sort_order\` = ?,
       \`is_active\` = ?
     WHERE \`id\` = ?`,
    [
      slug,
      name,
      short_description ?? null,
      description ?? null,
      icon ?? null,
      Number(fee_amount) || 0,
      Number(registration_fee) || 0,
      currency || 'NGN',
      Number(sort_order) || 0,
      is_active ? 1 : 0,
      id,
    ]
  );
};

/**
 * Delete a tier.
 */
export const deleteTier = async (id) => {
  await query('DELETE FROM `membership_tiers` WHERE `id` = ?', [id]);
};

/**
 * Count applications that reference a tier (for delete guard).
 */
export const countApplicationsForTier = async (tierId) => {
  const rows = await query(
    'SELECT COUNT(*) AS n FROM `membership_applications` WHERE `tier_id` = ?',
    [tierId]
  );
  return Number(rows[0].n);
};

/**
 * Toggle is_active.
 */
export const toggleTierActive = async (id, isActive) => {
  await query('UPDATE `membership_tiers` SET `is_active` = ? WHERE `id` = ?', [isActive ? 1 : 0, id]);
};

/**
 * Calculate the total payable for a tier.
 * Returns 0 for "quote-based" tiers (both fees are zero).
 */
export const calculateTierTotal = (tier) => {
  const membership = Number(tier.fee_amount) || 0;
  const registration = Number(tier.registration_fee) || 0;
  return membership + registration;
};

/**
 * Whether a tier requires payment (has any fee > 0).
 */
export const tierRequiresPayment = (tier) => calculateTierTotal(tier) > 0;