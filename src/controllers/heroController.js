// src/controllers/heroController.js
// Admin: CRUD for hero slides, with image upload support.

import { body, validationResult } from 'express-validator';
import {
  listSlides,
  findSlideById,
  createSlide,
  updateSlide,
  deleteSlide,
  toggleSlideActive,
} from '../models/heroModel.js';
import { deleteUploadedFile, replaceUploadedFile } from '../utils/fileCleanup.js';

// ─── Validation ─────────────────────────────────────────
// Note: image is now a file, not a body field. We validate the file separately in the controller.

export const heroValidators = [
  body('title')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Title must be between 2 and 200 characters.'),
  body('subtitle')
    .optional({ checkFalsy: true })
    .isLength({ max: 400 })
    .withMessage('Subtitle cannot exceed 400 characters.'),
  body('cta_text')
    .optional({ checkFalsy: true })
    .isLength({ max: 80 })
    .withMessage('Button text cannot exceed 80 characters.'),
  body('cta_url')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 })
    .withMessage('Button URL cannot exceed 255 characters.'),
  body('sort_order')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 9999 })
    .withMessage('Sort order must be a number between 0 and 9999.'),
];

// ─── GET /admin/hero ────────────────────────────────────

export const listHero = async (req, res) => {
  const slides = await listSlides(false);
  res.render('admin/hero/list', {
    title: 'Hero Slides',
    layout: 'layouts/admin',
    slides,
  });
};

// ─── GET /admin/hero/new ────────────────────────────────

export const showNewHero = (req, res) => {
  res.render('admin/hero/form', {
    title: 'New Hero Slide',
    layout: 'layouts/admin',
    slide: {
      id: null,
      title: '',
      subtitle: '',
      image_path: '',
      cta_text: '',
      cta_url: '',
      sort_order: 0,
      is_active: 1,
    },
    errors: [],
    mode: 'new',
  });
};

// ─── POST /admin/hero ───────────────────────────────────

export const postNewHero = async (req, res) => {
  const result = validationResult(req);

  // A file is required for new slides
  const fileError = !req.file ? 'Please choose an image for the slide.' : null;

  if (!result.isEmpty() || fileError) {
    // If we already saved a file but validation failed, clean it up
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['hero']);
    }

    const errs = result.isEmpty() ? [] : result.array();
    if (fileError) errs.unshift({ msg: fileError });

    return res.status(422).render('admin/hero/form', {
      title: 'New Hero Slide',
      layout: 'layouts/admin',
      slide: {
        id: null,
        title: req.body.title || '',
        subtitle: req.body.subtitle || '',
        image_path: '',
        cta_text: req.body.cta_text || '',
        cta_url: req.body.cta_url || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: errs,
      mode: 'new',
    });
  }

  await createSlide({
    title: req.body.title.trim(),
    subtitle: (req.body.subtitle || '').trim() || null,
    image_path: req.file.publicPath,
    cta_text: (req.body.cta_text || '').trim() || null,
    cta_url: (req.body.cta_url || '').trim() || null,
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'Hero slide created.');
  res.redirect('/admin/hero');
};

// ─── GET /admin/hero/:id/edit ───────────────────────────

export const showEditHero = async (req, res) => {
  const slide = await findSlideById(req.params.id);
  if (!slide) {
    req.flash('error', 'Hero slide not found.');
    return res.redirect('/admin/hero');
  }
  res.render('admin/hero/form', {
    title: 'Edit Hero Slide',
    layout: 'layouts/admin',
    slide,
    errors: [],
    mode: 'edit',
  });
};

// ─── POST /admin/hero/:id ───────────────────────────────

export const postEditHero = async (req, res) => {
  const slide = await findSlideById(req.params.id);
  if (!slide) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['hero']);
    }
    req.flash('error', 'Hero slide not found.');
    return res.redirect('/admin/hero');
  }

  const result = validationResult(req);

  if (!result.isEmpty()) {
    // Clean up any newly uploaded file — we're not keeping it
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['hero']);
    }
    return res.status(422).render('admin/hero/form', {
      title: 'Edit Hero Slide',
      layout: 'layouts/admin',
      slide: {
        ...slide,
        title: req.body.title || slide.title,
        subtitle: req.body.subtitle || '',
        cta_text: req.body.cta_text || '',
        cta_url: req.body.cta_url || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'edit',
    });
  }

  // Determine image path: keep old unless a new file was uploaded
  const oldImage = slide.image_path;
  const newImage = req.file ? req.file.publicPath : oldImage;

  await updateSlide(slide.id, {
    title: req.body.title.trim(),
    subtitle: (req.body.subtitle || '').trim() || null,
    image_path: newImage,
    cta_text: (req.body.cta_text || '').trim() || null,
    cta_url: (req.body.cta_url || '').trim() || null,
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  // Delete the old file only if it was actually replaced
  if (req.file && oldImage && oldImage !== newImage) {
    await replaceUploadedFile(oldImage, newImage, ['hero']);
  }

  req.flash('success', 'Hero slide updated.');
  res.redirect('/admin/hero');
};

// ─── POST /admin/hero/:id/toggle ────────────────────────

export const postToggleHero = async (req, res) => {
  const slide = await findSlideById(req.params.id);
  if (!slide) {
    req.flash('error', 'Hero slide not found.');
    return res.redirect('/admin/hero');
  }
  await toggleSlideActive(slide.id, !slide.is_active);
  req.flash('success', 'Hero slide status updated.');
  res.redirect('/admin/hero');
};

// ─── POST /admin/hero/:id/delete ────────────────────────

export const postDeleteHero = async (req, res) => {
  const slide = await findSlideById(req.params.id);
  if (!slide) {
    req.flash('error', 'Hero slide not found.');
    return res.redirect('/admin/hero');
  }

  // Delete DB row first, then file (file errors shouldn't block the delete)
  await deleteSlide(slide.id);

  if (slide.image_path) {
    await deleteUploadedFile(slide.image_path, ['hero']);
  }

  req.flash('success', 'Hero slide deleted.');
  res.redirect('/admin/hero');
};