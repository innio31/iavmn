// src/models/postModel.js
// Data access for the posts table (news/blog).

import { query } from '../db.js';

/**
 * List posts.
 * @param {object} opts
 * @param {boolean} opts.publishedOnly  If true, only is_published = 1.
 * @param {number}  opts.limit          Optional max rows.
 * @param {number}  opts.offset         Optional offset for pagination.
 * @param {number}  opts.excludeId      Optional post id to exclude (for "related posts").
 */
export const listPosts = async (opts = {}) => {
  const { publishedOnly = false, limit = null, offset = 0, excludeId = null } = opts;

  let sql = 'SELECT * FROM `posts`';
  const where = [];
  const params = [];

  if (publishedOnly) where.push('`is_published` = 1');
  if (excludeId) {
    where.push('`id` <> ?');
    params.push(excludeId);
  }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');

  sql += publishedOnly
    ? ' ORDER BY `published_at` DESC, `id` DESC'
    : ' ORDER BY `updated_at` DESC, `id` DESC';

  if (limit && Number.isFinite(Number(limit))) {
    sql += ' LIMIT ?';
    params.push(Number(limit));

    if (offset && Number.isFinite(Number(offset))) {
      sql += ' OFFSET ?';
      params.push(Number(offset));
    }
  }

  return query(sql, params);
};

/**
 * Count posts.
 * @param {boolean} publishedOnly
 */
export const countPosts = async (publishedOnly = false) => {
  const sql = publishedOnly
    ? 'SELECT COUNT(*) AS n FROM `posts` WHERE `is_published` = 1'
    : 'SELECT COUNT(*) AS n FROM `posts`';
  const rows = await query(sql);
  return Number(rows[0].n);
};

/**
 * Find a post by id.
 */
export const findPostById = async (id) => {
  const rows = await query('SELECT * FROM `posts` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * Find a published post by slug (for public URLs).
 */
export const findPostBySlug = async (slug) => {
  const rows = await query(
    'SELECT * FROM `posts` WHERE `slug` = ? AND `is_published` = 1 LIMIT 1',
    [slug]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Find a post by slug regardless of publish state (for admin preview / uniqueness).
 */
export const findAnyPostBySlug = async (slug) => {
  const rows = await query('SELECT * FROM `posts` WHERE `slug` = ? LIMIT 1', [slug]);
  return rows.length ? rows[0] : null;
};

/**
 * Check whether a slug is already in use (optionally excluding an id).
 */
export const slugExists = async (slug, excludeId = null) => {
  const sql = excludeId
    ? 'SELECT `id` FROM `posts` WHERE `slug` = ? AND `id` <> ? LIMIT 1'
    : 'SELECT `id` FROM `posts` WHERE `slug` = ? LIMIT 1';
  const params = excludeId ? [slug, excludeId] : [slug];
  const rows = await query(sql, params);
  return rows.length > 0;
};

/**
 * Create a post.
 */
export const createPost = async ({
  slug,
  title,
  excerpt,
  body,
  cover_image_path,
  author_id = null,
  is_published = 0,
  published_at = null,
}) => {
  const result = await query(
    `INSERT INTO \`posts\`
       (\`slug\`, \`title\`, \`excerpt\`, \`body\`, \`cover_image_path\`, \`author_id\`, \`is_published\`, \`published_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      title,
      excerpt ?? null,
      body ?? null,
      cover_image_path ?? null,
      author_id ?? null,
      is_published ? 1 : 0,
      published_at,
    ]
  );
  return result.insertId;
};

/**
 * Update a post.
 */
export const updatePost = async (id, {
  slug,
  title,
  excerpt,
  body,
  cover_image_path,
  author_id,
  is_published,
  published_at,
}) => {
  await query(
    `UPDATE \`posts\` SET
       \`slug\` = ?,
       \`title\` = ?,
       \`excerpt\` = ?,
       \`body\` = ?,
       \`cover_image_path\` = ?,
       \`author_id\` = ?,
       \`is_published\` = ?,
       \`published_at\` = ?
     WHERE \`id\` = ?`,
    [
      slug,
      title,
      excerpt ?? null,
      body ?? null,
      cover_image_path ?? null,
      author_id ?? null,
      is_published ? 1 : 0,
      published_at,
      id,
    ]
  );
};

/**
 * Delete a post.
 */
export const deletePost = async (id) => {
  await query('DELETE FROM `posts` WHERE `id` = ?', [id]);
};

/**
 * Toggle is_published. When publishing and no published_at is set, stamps NOW().
 */
export const togglePostPublished = async (id, isPublished) => {
  if (isPublished) {
    await query(
      'UPDATE `posts` SET `is_published` = 1, `published_at` = COALESCE(`published_at`, NOW()) WHERE `id` = ?',
      [id]
    );
  } else {
    await query('UPDATE `posts` SET `is_published` = 0 WHERE `id` = ?', [id]);
  }
};