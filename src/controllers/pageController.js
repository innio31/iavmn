// src/controllers/pageController.js
// Admin CRUD + public renderer for editable pages.

import { body, validationResult } from 'express-validator';
import {
  listPages,
  findPageById,
  findPageBySlug,
  slugExists,
  createPage,
  updatePage,
  deletePage,
  togglePagePublished,
} from '../models/pageModel.js';
import { clearMenuPagesCache } from '../middleware/loadMenuPages.js';

// ─── Helpers ────────────────────────────────────────────

const slugify = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'page';

const ensureUniqueSlug = async (base, excludeId = null) => {
  let candidate = base;
  let n = 1;
  while (await slugExists(candidate, excludeId)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};

// Reserved slugs handled by dedicated routes elsewhere.
const RESERVED_SLUGS = ['contact', 'membership', 'faq', 'council-members'];

// ─── Validation ─────────────────────────────────────────

export const pageValidators = [
  body('title')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Title must be between 2 and 200 characters.'),
  body('slug')
    .optional({ checkFalsy: true })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Custom URL can only contain lowercase letters, numbers, and hyphens.')
    .isLength({ max: 120 })
    .withMessage('Custom URL is too long.'),
  body('meta_title')
    .optional({ checkFalsy: true })
    .isLength({ max: 200 })
    .withMessage('Meta title cannot exceed 200 characters.'),
  body('meta_description')
    .optional({ checkFalsy: true })
    .isLength({ max: 320 })
    .withMessage('Meta description cannot exceed 320 characters.'),
  body('menu_label')
    .optional({ checkFalsy: true })
    .isLength({ max: 60 })
    .withMessage('Menu label cannot exceed 60 characters.'),
  body('menu_order')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 9999 })
    .withMessage('Menu order must be a number between 0 and 9999.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listPagesAdmin = async (req, res) => {
  const pages = await listPages(false);
  res.render('admin/pages/list', {
    title: 'Pages',
    layout: 'layouts/admin',
    pages,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewPage = (req, res) => {
  res.render('admin/pages/form', {
    title: 'New Page',
    layout: 'layouts/admin',
    page: {
      id: null,
      slug: '',
      title: '',
      content: '',
      meta_title: '',
      meta_description: '',
      is_published: 1,
      show_in_menu: 0,
      menu_label: '',
      menu_order: 0,
    },
    errors: [],
    mode: 'new',
  });
};

export const postNewPage = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('admin/pages/form', {
      title: 'New Page',
      layout: 'layouts/admin',
      page: {
        id: null,
        slug: req.body.slug || '',
        title: req.body.title || '',
        content: req.body.content || '',
        meta_title: req.body.meta_title || '',
        meta_description: req.body.meta_description || '',
        is_published: req.body.is_published ? 1 : 0,
        show_in_menu: req.body.show_in_menu ? 1 : 0,
        menu_label: req.body.menu_label || '',
        menu_order: Number(req.body.menu_order) || 0,
      },
      errors: result.array(),
      mode: 'new',
    });
  }

  const title = req.body.title.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(title);
  const slug = await ensureUniqueSlug(baseSlug);

  await createPage({
    slug,
    title,
    content: (req.body.content || '').trim() || null,
    meta_title: (req.body.meta_title || '').trim() || null,
    meta_description: (req.body.meta_description || '').trim() || null,
    is_published: req.body.is_published ? 1 : 0,
    show_in_menu: req.body.show_in_menu ? 1 : 0,
    menu_label: (req.body.menu_label || '').trim() || null,
    menu_order: Number(req.body.menu_order) || 0,
  });

  clearMenuPagesCache();

  req.flash('success', 'Page created.');
  res.redirect('/admin/pages');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditPage = async (req, res) => {
  const page = await findPageById(req.params.id);
  if (!page) {
    req.flash('error', 'Page not found.');
    return res.redirect('/admin/pages');
  }
  res.render('admin/pages/form', {
    title: 'Edit Page',
    layout: 'layouts/admin',
    page,
    errors: [],
    mode: 'edit',
  });
};

export const postEditPage = async (req, res) => {
  const page = await findPageById(req.params.id);
  if (!page) {
    req.flash('error', 'Page not found.');
    return res.redirect('/admin/pages');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('admin/pages/form', {
      title: 'Edit Page',
      layout: 'layouts/admin',
      page: {
        ...page,
        slug: req.body.slug || page.slug,
        title: req.body.title || page.title,
        content: req.body.content || '',
        meta_title: req.body.meta_title || '',
        meta_description: req.body.meta_description || '',
        is_published: req.body.is_published ? 1 : 0,
        show_in_menu: req.body.show_in_menu ? 1 : 0,
        menu_label: req.body.menu_label || '',
        menu_order: Number(req.body.menu_order) || 0,
      },
      errors: result.array(),
      mode: 'edit',
    });
  }

  const title = req.body.title.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(title);
  const slug = await ensureUniqueSlug(baseSlug, page.id);

  await updatePage(page.id, {
    slug,
    title,
    content: (req.body.content || '').trim() || null,
    meta_title: (req.body.meta_title || '').trim() || null,
    meta_description: (req.body.meta_description || '').trim() || null,
    is_published: req.body.is_published ? 1 : 0,
    show_in_menu: req.body.show_in_menu ? 1 : 0,
    menu_label: (req.body.menu_label || '').trim() || null,
    menu_order: Number(req.body.menu_order) || 0,
  });

  clearMenuPagesCache();

  req.flash('success', 'Page updated.');
  res.redirect('/admin/pages');
};

// ─── Admin: toggle publish ──────────────────────────────

export const postTogglePage = async (req, res) => {
  const page = await findPageById(req.params.id);
  if (!page) {
    req.flash('error', 'Page not found.');
    return res.redirect('/admin/pages');
  }
  await togglePagePublished(page.id, !page.is_published);
  clearMenuPagesCache();
  req.flash('success', 'Page status updated.');
  res.redirect('/admin/pages');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeletePage = async (req, res) => {
  const page = await findPageById(req.params.id);
  if (!page) {
    req.flash('error', 'Page not found.');
    return res.redirect('/admin/pages');
  }

  // Never delete a page whose slug collides with a dedicated route.
  if (RESERVED_SLUGS.includes(page.slug)) {
    req.flash(
      'error',
      `"${page.slug}" is a reserved route used by the site — this page cannot be deleted. Unpublish it instead, or change its URL.`
    );
    return res.redirect('/admin/pages');
  }

  await deletePage(page.id);
  clearMenuPagesCache();
  req.flash('success', 'Page deleted.');
  res.redirect('/admin/pages');
};

// ─── Public: render a page by slug ──────────────────────

export const publicPage = async (req, res, next) => {
  const slug = req.params.slug;
  const page = await findPageBySlug(slug, true);
  if (!page) return next();
  res.render('page', {
    title: page.title,
    page,
  });
};