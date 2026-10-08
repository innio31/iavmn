// src/controllers/postController.js
// Admin: CRUD for posts (news/blog).
// Public: listing with pagination, single post by slug.

import { body, validationResult } from 'express-validator';
import {
  listPosts,
  countPosts,
  findPostById,
  findPostBySlug,
  slugExists,
  createPost,
  updatePost,
  deletePost,
  togglePostPublished,
} from '../models/postModel.js';
import { deleteUploadedFile, replaceUploadedFile } from '../utils/fileCleanup.js';

const POSTS_PER_PAGE = 9;

// ─── Helpers ────────────────────────────────────────────

const slugify = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'post';

const ensureUniqueSlug = async (base, excludeId = null) => {
  let candidate = base;
  let n = 1;
  while (await slugExists(candidate, excludeId)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};

/**
 * Given a date string "YYYY-MM-DD" from a datetime-local input,
 * convert to MySQL DATETIME "YYYY-MM-DD HH:MM:SS" or null.
 */
const parsePublishedAt = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept "YYYY-MM-DDTHH:MM" (from datetime-local) or "YYYY-MM-DD HH:MM"
  const normalized = trimmed.replace('T', ' ');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

/**
 * Format a MySQL DATETIME for the datetime-local input value.
 */
const formatForInput = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Validation ─────────────────────────────────────────

export const postValidators = [
  body('title')
    .trim()
    .isLength({ min: 2, max: 250 })
    .withMessage('Title must be between 2 and 250 characters.'),
  body('slug')
    .optional({ checkFalsy: true })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Custom URL can only contain lowercase letters, numbers, and hyphens.')
    .isLength({ max: 200 })
    .withMessage('Custom URL is too long.'),
  body('excerpt')
    .optional({ checkFalsy: true })
    .isLength({ max: 400 })
    .withMessage('Excerpt cannot exceed 400 characters.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listPostsAdmin = async (req, res) => {
  const posts = await listPosts({ publishedOnly: false });
  res.render('admin/posts/list', {
    title: 'Posts',
    layout: 'layouts/admin',
    posts,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewPost = (req, res) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const defaultPublishedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  res.render('admin/posts/form', {
    title: 'New Post',
    layout: 'layouts/admin',
    post: {
      id: null,
      slug: '',
      title: '',
      excerpt: '',
      body: '',
      cover_image_path: '',
      author_id: req.session.user ? req.session.user.user_id : null,
      is_published: 0,
      published_at: defaultPublishedAt,
    },
    publishedAtInput: defaultPublishedAt,
    errors: [],
    mode: 'new',
  });
};

export const postNewPost = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['posts']);
    }
    return res.status(422).render('admin/posts/form', {
      title: 'New Post',
      layout: 'layouts/admin',
      post: {
        id: null,
        slug: req.body.slug || '',
        title: req.body.title || '',
        excerpt: req.body.excerpt || '',
        body: req.body.body || '',
        cover_image_path: '',
        author_id: req.session.user ? req.session.user.user_id : null,
        is_published: req.body.is_published ? 1 : 0,
        published_at: req.body.published_at || '',
      },
      publishedAtInput: formatForInput(req.body.published_at) || req.body.published_at || '',
      errors: result.array(),
      mode: 'new',
    });
  }

  const title = req.body.title.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(title);
  const slug = await ensureUniqueSlug(baseSlug);

  const isPublished = req.body.is_published ? 1 : 0;
  let publishedAt = parsePublishedAt(req.body.published_at);
  // If publishing but no date given, use NOW()
  if (isPublished && !publishedAt) {
    publishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  await createPost({
    slug,
    title,
    excerpt: (req.body.excerpt || '').trim() || null,
    body: (req.body.body || '').trim() || null,
    cover_image_path: req.file ? req.file.publicPath : null,
    author_id: req.session.user ? req.session.user.user_id : null,
    is_published: isPublished,
    published_at: publishedAt,
  });

  req.flash('success', 'Post created.');
  res.redirect('/admin/posts');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditPost = async (req, res) => {
  const post = await findPostById(req.params.id);
  if (!post) {
    req.flash('error', 'Post not found.');
    return res.redirect('/admin/posts');
  }
  res.render('admin/posts/form', {
    title: 'Edit Post',
    layout: 'layouts/admin',
    post,
    publishedAtInput: formatForInput(post.published_at),
    errors: [],
    mode: 'edit',
  });
};

export const postEditPost = async (req, res) => {
  const post = await findPostById(req.params.id);
  if (!post) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['posts']);
    }
    req.flash('error', 'Post not found.');
    return res.redirect('/admin/posts');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['posts']);
    }
    return res.status(422).render('admin/posts/form', {
      title: 'Edit Post',
      layout: 'layouts/admin',
      post: {
        ...post,
        slug: req.body.slug || post.slug,
        title: req.body.title || post.title,
        excerpt: req.body.excerpt || '',
        body: req.body.body || '',
        is_published: req.body.is_published ? 1 : 0,
        published_at: req.body.published_at || '',
      },
      publishedAtInput: req.body.published_at || '',
      errors: result.array(),
      mode: 'edit',
    });
  }

  const title = req.body.title.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(title);
  const slug = await ensureUniqueSlug(baseSlug, post.id);

  const oldCover = post.cover_image_path;
  const newCover = req.file ? req.file.publicPath : oldCover;

  const isPublished = req.body.is_published ? 1 : 0;
  let publishedAt = parsePublishedAt(req.body.published_at);
  // If publishing but no date given, preserve existing or stamp NOW()
  if (isPublished && !publishedAt) {
    publishedAt = post.published_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  await updatePost(post.id, {
    slug,
    title,
    excerpt: (req.body.excerpt || '').trim() || null,
    body: (req.body.body || '').trim() || null,
    cover_image_path: newCover,
    author_id: post.author_id,
    is_published: isPublished,
    published_at: publishedAt,
  });

  if (req.file && oldCover && oldCover !== newCover) {
    await replaceUploadedFile(oldCover, newCover, ['posts']);
  }

  req.flash('success', 'Post updated.');
  res.redirect('/admin/posts');
};

// ─── Admin: toggle ──────────────────────────────────────

export const postTogglePost = async (req, res) => {
  const post = await findPostById(req.params.id);
  if (!post) {
    req.flash('error', 'Post not found.');
    return res.redirect('/admin/posts');
  }
  await togglePostPublished(post.id, !post.is_published);
  req.flash('success', 'Post status updated.');
  res.redirect('/admin/posts');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeletePost = async (req, res) => {
  const post = await findPostById(req.params.id);
  if (!post) {
    req.flash('error', 'Post not found.');
    return res.redirect('/admin/posts');
  }

  await deletePost(post.id);

  if (post.cover_image_path) {
    await deleteUploadedFile(post.cover_image_path, ['posts']);
  }

  req.flash('success', 'Post deleted.');
  res.redirect('/admin/posts');
};

// ─── Public: list ───────────────────────────────────────

export const publicListPosts = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;

  const [posts, total] = await Promise.all([
    listPosts({ publishedOnly: true, limit: POSTS_PER_PAGE, offset }),
    countPosts(true),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  res.render('posts/list', {
    title: 'News & Updates',
    posts,
    page,
    totalPages,
    total,
  });
};

// ─── Public: single post ────────────────────────────────

export const publicPostDetail = async (req, res, next) => {
  const post = await findPostBySlug(req.params.slug);
  if (!post) return next();

  // Recent 3 others for "you might also like"
  const related = await listPosts({
    publishedOnly: true,
    limit: 3,
    excludeId: post.id,
  });

  res.render('posts/detail', {
    title: post.title,
    post,
    related,
  });
};