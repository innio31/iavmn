// src/models/searchModel.js
// Full-text-ish search across public content.
// Uses LIKE '%term%' — sufficient for the current content volume.
// When content grows past a few thousand rows, migrate to MySQL FULLTEXT indexes.

import { query } from '../db.js';

/**
 * Sanitize a search term for use in a LIKE clause.
 * - Trim whitespace
 * - Collapse internal whitespace
 * - Strip characters MySQL LIKE treats specially (%, _) by escaping them
 * - Cap length to prevent absurdly long terms
 */
export const sanitizeSearchTerm = (raw) => {
  if (typeof raw !== 'string') return '';
  let term = raw.trim().replace(/\s+/g, ' ');
  if (term.length > 100) term = term.slice(0, 100);
  // Escape LIKE wildcards so a user typing '%' doesn't match everything
  term = term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return term;
};

/**
 * Search published posts.
 */
export const searchPosts = async (term, limit = 20) => {
  if (!term) return [];
  const like = `%${term}%`;
  return query(
    `SELECT id, slug, title, excerpt, cover_image_path, published_at
     FROM \`posts\`
     WHERE \`is_published\` = 1
       AND (\`title\` LIKE ? OR \`excerpt\` LIKE ? OR \`body\` LIKE ?)
     ORDER BY
       CASE
         WHEN \`title\` LIKE ? THEN 1
         WHEN \`excerpt\` LIKE ? THEN 2
         ELSE 3
       END,
       \`published_at\` DESC
     LIMIT ?`,
    [like, like, like, like, like, Number(limit)]
  );
};

/**
 * Search published pages.
 */
export const searchPages = async (term, limit = 20) => {
  if (!term) return [];
  const like = `%${term}%`;
  return query(
    `SELECT id, slug, title, meta_description, content
     FROM \`pages\`
     WHERE \`is_published\` = 1
       AND (\`title\` LIKE ? OR \`content\` LIKE ? OR \`meta_description\` LIKE ?)
     ORDER BY
       CASE
         WHEN \`title\` LIKE ? THEN 1
         WHEN \`meta_description\` LIKE ? THEN 2
         ELSE 3
       END,
       \`updated_at\` DESC
     LIMIT ?`,
    [like, like, like, like, like, Number(limit)]
  );
};

/**
 * Search active FAQs.
 */
export const searchFaqs = async (term, limit = 20) => {
  if (!term) return [];
  const like = `%${term}%`;
  return query(
    `SELECT id, question, answer
     FROM \`faqs\`
     WHERE \`is_active\` = 1
       AND (\`question\` LIKE ? OR \`answer\` LIKE ?)
     ORDER BY
       CASE
         WHEN \`question\` LIKE ? THEN 1
         ELSE 2
       END,
       \`sort_order\` ASC
     LIMIT ?`,
    [like, like, like, Number(limit)]
  );
};

/**
 * Search active council members.
 */
export const searchCouncilMembers = async (term, limit = 20) => {
  if (!term) return [];
  const like = `%${term}%`;
  return query(
    `SELECT id, slug, full_name, job_title, bio_short, photo_path
     FROM \`council_members\`
     WHERE \`is_active\` = 1
       AND (\`full_name\` LIKE ? OR \`job_title\` LIKE ? OR \`bio_short\` LIKE ? OR \`bio_full\` LIKE ?)
     ORDER BY
       CASE
         WHEN \`full_name\` LIKE ? THEN 1
         WHEN \`job_title\` LIKE ? THEN 2
         ELSE 3
       END,
       \`sort_order\` ASC
     LIMIT ?`,
    [like, like, like, like, like, like, Number(limit)]
  );
};

/**
 * Search active membership tiers.
 */
export const searchTiers = async (term, limit = 20) => {
  if (!term) return [];
  const like = `%${term}%`;
  return query(
    `SELECT id, slug, name, short_description, icon, fee_amount, currency
     FROM \`membership_tiers\`
     WHERE \`is_active\` = 1
       AND (\`name\` LIKE ? OR \`short_description\` LIKE ? OR \`description\` LIKE ?)
     ORDER BY
       CASE
         WHEN \`name\` LIKE ? THEN 1
         ELSE 2
       END,
       \`sort_order\` ASC
     LIMIT ?`,
    [like, like, like, like, Number(limit)]
  );
};

/**
 * Run a search across all content types in parallel.
 * @returns {Promise<{
 *   term: string,
 *   posts: Array,
 *   pages: Array,
 *   faqs: Array,
 *   council: Array,
 *   tiers: Array,
 *   totalCount: number
 * }>}
 */
export const searchAll = async (rawTerm) => {
  const term = sanitizeSearchTerm(rawTerm);
  if (!term) {
    return {
      term: '',
      posts: [],
      pages: [],
      faqs: [],
      council: [],
      tiers: [],
      totalCount: 0,
    };
  }

  const [posts, pages, faqs, council, tiers] = await Promise.all([
    searchPosts(term, 20),
    searchPages(term, 20),
    searchFaqs(term, 20),
    searchCouncilMembers(term, 20),
    searchTiers(term, 10),
  ]);

  return {
    term,
    posts,
    pages,
    faqs,
    council,
    tiers,
    totalCount: posts.length + pages.length + faqs.length + council.length + tiers.length,
  };
};