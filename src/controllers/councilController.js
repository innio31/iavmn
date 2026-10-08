// src/controllers/councilController.js
// Admin + public: council members.
// Admin: list, create, edit, toggle, delete.
// Public: list, profile by slug.

import { body, validationResult } from 'express-validator';
import {
  listMembers,
  findMemberById,
  findMemberBySlug,
  slugExists,
  createMember,
  updateMember,
  deleteMember,
  toggleMemberActive,
} from '../models/councilModel.js';
import { deleteUploadedFile, replaceUploadedFile } from '../utils/fileCleanup.js';

// ─── Helpers ────────────────────────────────────────────

/**
 * Convert a string into a URL-safe slug.
 */
const slugify = (str) => {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')       // strip accents
    .replace(/[^a-z0-9]+/g, '-')           // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')               // trim hyphens
    .slice(0, 140) || 'member';
};

/**
 * Ensure a slug is unique. Appends -2, -3, ... as needed.
 */
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

export const memberValidators = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 180 })
    .withMessage('Full name must be between 2 and 180 characters.'),
  body('job_title')
    .optional({ checkFalsy: true })
    .isLength({ max: 180 })
    .withMessage('Job title cannot exceed 180 characters.'),
  body('bio_short')
    .optional({ checkFalsy: true })
    .isLength({ max: 400 })
    .withMessage('Short bio cannot exceed 400 characters.'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .isLength({ max: 180 })
    .withMessage('Email is too long.'),
  body('linkedin_url')
    .optional({ checkFalsy: true })
    .isURL({ require_protocol: true })
    .withMessage('LinkedIn URL must start with http:// or https://.')
    .isLength({ max: 255 })
    .withMessage('LinkedIn URL is too long.'),
  body('sort_order')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 9999 })
    .withMessage('Display order must be a number between 0 and 9999.'),
  body('slug')
    .optional({ checkFalsy: true })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Custom URL can only contain lowercase letters, numbers, and hyphens.')
    .isLength({ max: 160 })
    .withMessage('Custom URL is too long.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listCouncil = async (req, res) => {
  const members = await listMembers(false);
  res.render('admin/council/list', {
    title: 'Council Members',
    layout: 'layouts/admin',
    members,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewMember = (req, res) => {
  res.render('admin/council/form', {
    title: 'New Council Member',
    layout: 'layouts/admin',
    member: {
      id: null,
      slug: '',
      full_name: '',
      job_title: '',
      bio_short: '',
      bio_full: '',
      photo_path: '',
      email: '',
      linkedin_url: '',
      sort_order: 0,
      is_active: 1,
    },
    errors: [],
    mode: 'new',
  });
};

export const postNewMember = async (req, res) => {
  const result = validationResult(req);
  const fileError = !req.file ? 'Please upload a photo for the member.' : null;

  if (!result.isEmpty() || fileError) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['council']);
    }
    const errs = result.isEmpty() ? [] : result.array();
    if (fileError) errs.unshift({ msg: fileError });

    return res.status(422).render('admin/council/form', {
      title: 'New Council Member',
      layout: 'layouts/admin',
      member: {
        id: null,
        slug: req.body.slug || '',
        full_name: req.body.full_name || '',
        job_title: req.body.job_title || '',
        bio_short: req.body.bio_short || '',
        bio_full: req.body.bio_full || '',
        photo_path: '',
        email: req.body.email || '',
        linkedin_url: req.body.linkedin_url || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: errs,
      mode: 'new',
    });
  }

  const fullName = req.body.full_name.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(fullName);
  const slug = await ensureUniqueSlug(baseSlug);

  const id = await createMember({
    slug,
    full_name: fullName,
    job_title: (req.body.job_title || '').trim() || null,
    bio_short: (req.body.bio_short || '').trim() || null,
    bio_full: (req.body.bio_full || '').trim() || null,
    photo_path: req.file.publicPath,
    email: (req.body.email || '').trim() || null,
    linkedin_url: (req.body.linkedin_url || '').trim() || null,
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'Council member created.');
  res.redirect('/admin/council');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditMember = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Council member not found.');
    return res.redirect('/admin/council');
  }
  res.render('admin/council/form', {
    title: 'Edit Council Member',
    layout: 'layouts/admin',
    member,
    errors: [],
    mode: 'edit',
  });
};

export const postEditMember = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['council']);
    }
    req.flash('error', 'Council member not found.');
    return res.redirect('/admin/council');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['council']);
    }
    return res.status(422).render('admin/council/form', {
      title: 'Edit Council Member',
      layout: 'layouts/admin',
      member: {
        ...member,
        slug: req.body.slug || member.slug,
        full_name: req.body.full_name || member.full_name,
        job_title: req.body.job_title || '',
        bio_short: req.body.bio_short || '',
        bio_full: req.body.bio_full || '',
        email: req.body.email || '',
        linkedin_url: req.body.linkedin_url || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'edit',
    });
  }

  const fullName = req.body.full_name.trim();
  const customSlug = (req.body.slug || '').trim();
  const baseSlug = customSlug ? slugify(customSlug) : slugify(fullName);
  const slug = await ensureUniqueSlug(baseSlug, member.id);

  const oldPhoto = member.photo_path;
  const newPhoto = req.file ? req.file.publicPath : oldPhoto;

  await updateMember(member.id, {
    slug,
    full_name: fullName,
    job_title: (req.body.job_title || '').trim() || null,
    bio_short: (req.body.bio_short || '').trim() || null,
    bio_full: (req.body.bio_full || '').trim() || null,
    photo_path: newPhoto,
    email: (req.body.email || '').trim() || null,
    linkedin_url: (req.body.linkedin_url || '').trim() || null,
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  if (req.file && oldPhoto && oldPhoto !== newPhoto) {
    await replaceUploadedFile(oldPhoto, newPhoto, ['council']);
  }

  req.flash('success', 'Council member updated.');
  res.redirect('/admin/council');
};

// ─── Admin: toggle / delete ─────────────────────────────

export const postToggleMember = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Council member not found.');
    return res.redirect('/admin/council');
  }
  await toggleMemberActive(member.id, !member.is_active);
  req.flash('success', 'Member status updated.');
  res.redirect('/admin/council');
};

export const postDeleteMember = async (req, res) => {
  const member = await findMemberById(req.params.id);
  if (!member) {
    req.flash('error', 'Council member not found.');
    return res.redirect('/admin/council');
  }

  await deleteMember(member.id);

  if (member.photo_path) {
    await deleteUploadedFile(member.photo_path, ['council']);
  }

  req.flash('success', 'Council member deleted.');
  res.redirect('/admin/council');
};

// ─── Public: list ───────────────────────────────────────

export const publicListCouncil = async (req, res) => {
  const members = await listMembers(true);
  res.render('council/list', {
    title: 'Council Members',
    members,
  });
};

// ─── Public: profile ────────────────────────────────────

export const publicMemberProfile = async (req, res, next) => {
  const member = await findMemberBySlug(req.params.slug);
  if (!member) return next();
  res.render('council/profile', {
    title: member.full_name,
    member,
  });
};