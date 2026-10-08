// src/controllers/tierController.js
// Admin + public: membership tiers.

import { body, validationResult } from 'express-validator';
import {
  listTiers,
  findTierById,
  findTierBySlug,
  slugExists,
  createTier,
  updateTier,
  deleteTier,
  countApplicationsForTier,
  toggleTierActive,
} from '../models/tierModel.js';

// ─── Helpers ────────────────────────────────────────────

const slugify = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tier';

const ensureUniqueSlug = async (base, excludeId = null) => {
  let candidate = base;
  let n = 1;
  while (await slugExists(candidate, excludeId)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};

// ─── Validation ─────────────────────────────────────────

export const tierValidators = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters.'),
  body('slug')
    .optional({ checkFalsy: true })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Custom URL can only contain lowercase letters, numbers, and hyphens.')
    .isLength({ max: 60 })
    .withMessage('Custom URL is too long.'),
  body('short_description')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 })
    .withMessage('Short description cannot exceed 255 characters.'),
  body('icon')
    .optional({ checkFalsy: true })
    .isLength({ max: 80 })
    .withMessage('Icon cannot exceed 80 characters.'),
  body('fee_amount')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 999999999 })
    .withMessage('Fee must be a positive number.'),
  body('currency')
    .optional({ checkFalsy: true })
    .isLength({ min: 3, max: 8 })
    .withMessage('Currency must be 3–8 characters (e.g. NGN).'),
  body('sort_order')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 9999 })
    .withMessage('Display order must be a number between 0 and 9999.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listTiersAdmin = async (req, res) => {
  const tiers = await listTiers(false);
  res.render('admin/tiers/list', {
    title: 'Membership Tiers',
    layout: 'layouts/admin',
    tiers,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewTier = (req, res) => {
  res.render('admin/tiers/form', {
    title: 'New Membership Tier',
    layout: 'layouts/admin',
    tier: {
      id: null,
      slug: '',
      name: '',
      short_description: '',
      description: '',
      icon: '',
      fee_amount: 0,
      currency: 'NGN',
      sort_order: 0,
      is_active: 1,
    },
    errors: [],
    mode: 'new',
  });
};

export const postNewTier = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('admin/tiers/form', {
      title: 'New Membership Tier',
      layout: 'layouts/admin',
      tier: {
        id: null,
        slug: req.body.slug || '',
        name: req.body.name || '',
        short_description: req.body.short_description || '',
        description: req.body.description || '',
        icon: req.body.icon || '',
        fee_amount: Number(req.body.fee_amount) || 0,
        currency: req.body.currency || 'NGN',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'new',
    });
  }

  const name = req.body.name.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(name);
  const slug = await ensureUniqueSlug(baseSlug);

  await createTier({
    slug,
    name,
    short_description: (req.body.short_description || '').trim() || null,
    description: (req.body.description || '').trim() || null,
    icon: (req.body.icon || '').trim() || null,
    fee_amount: Number(req.body.fee_amount) || 0,
    currency: (req.body.currency || 'NGN').trim().toUpperCase(),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'Membership tier created.');
  res.redirect('/admin/tiers');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditTier = async (req, res) => {
  const tier = await findTierById(req.params.id);
  if (!tier) {
    req.flash('error', 'Membership tier not found.');
    return res.redirect('/admin/tiers');
  }
  res.render('admin/tiers/form', {
    title: 'Edit Membership Tier',
    layout: 'layouts/admin',
    tier,
    errors: [],
    mode: 'edit',
  });
};

export const postEditTier = async (req, res) => {
  const tier = await findTierById(req.params.id);
  if (!tier) {
    req.flash('error', 'Membership tier not found.');
    return res.redirect('/admin/tiers');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('admin/tiers/form', {
      title: 'Edit Membership Tier',
      layout: 'layouts/admin',
      tier: {
        ...tier,
        slug: req.body.slug || tier.slug,
        name: req.body.name || tier.name,
        short_description: req.body.short_description || '',
        description: req.body.description || '',
        icon: req.body.icon || '',
        fee_amount: Number(req.body.fee_amount) || 0,
        currency: req.body.currency || 'NGN',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'edit',
    });
  }

  const name = req.body.name.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(name);
  const slug = await ensureUniqueSlug(baseSlug, tier.id);

  await updateTier(tier.id, {
    slug,
    name,
    short_description: (req.body.short_description || '').trim() || null,
    description: (req.body.description || '').trim() || null,
    icon: (req.body.icon || '').trim() || null,
    fee_amount: Number(req.body.fee_amount) || 0,
    currency: (req.body.currency || 'NGN').trim().toUpperCase(),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'Membership tier updated.');
  res.redirect('/admin/tiers');
};

// ─── Admin: toggle ──────────────────────────────────────

export const postToggleTier = async (req, res) => {
  const tier = await findTierById(req.params.id);
  if (!tier) {
    req.flash('error', 'Membership tier not found.');
    return res.redirect('/admin/tiers');
  }
  await toggleTierActive(tier.id, !tier.is_active);
  req.flash('success', 'Tier status updated.');
  res.redirect('/admin/tiers');
};

// ─── Admin: delete (with applications guard) ────────────

export const postDeleteTier = async (req, res) => {
  const tier = await findTierById(req.params.id);
  if (!tier) {
    req.flash('error', 'Membership tier not found.');
    return res.redirect('/admin/tiers');
  }

  // Guard: refuse to delete a tier that has applications
  const appCount = await countApplicationsForTier(tier.id);
  if (appCount > 0) {
    req.flash(
      'error',
      `Cannot delete "${tier.name}" — ${appCount} application${appCount === 1 ? '' : 's'} reference this tier. Hide it instead.`
    );
    return res.redirect('/admin/tiers');
  }

  await deleteTier(tier.id);
  req.flash('success', 'Membership tier deleted.');
  res.redirect('/admin/tiers');
};

// ─── Public: list all tiers ─────────────────────────────

export const publicListTiers = async (req, res) => {
  const tiers = await listTiers(true);
  res.render('membership/list', {
    title: 'Membership',
    tiers,
  });
};

// ─── Public: single tier ────────────────────────────────

export const publicTierDetail = async (req, res, next) => {
  const tier = await findTierBySlug(req.params.slug);
  if (!tier) return next();
  res.render('membership/detail', {
    title: tier.name,
    tier,
  });
};