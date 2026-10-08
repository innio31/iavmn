// src/controllers/testimonialController.js
// Admin: CRUD for testimonials. Public: homepage section reads via model.

import { body, validationResult } from 'express-validator';
import {
  listTestimonials,
  findTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialActive,
} from '../models/testimonialModel.js';
import { deleteUploadedFile, replaceUploadedFile } from '../utils/fileCleanup.js';

// ─── Validation ─────────────────────────────────────────

export const testimonialValidators = [
  body('author_name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Author name must be between 2 and 120 characters.'),
  body('author_title')
    .optional({ checkFalsy: true })
    .isLength({ max: 180 })
    .withMessage('Author title cannot exceed 180 characters.'),
  body('quote')
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage('Quote must be between 5 and 2000 characters.'),
  body('sort_order')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 9999 })
    .withMessage('Display order must be a number between 0 and 9999.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listTestimonialsAdmin = async (req, res) => {
  const testimonials = await listTestimonials(false);
  res.render('admin/testimonials/list', {
    title: 'Testimonials',
    layout: 'layouts/admin',
    testimonials,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewTestimonial = (req, res) => {
  res.render('admin/testimonials/form', {
    title: 'New Testimonial',
    layout: 'layouts/admin',
    testimonial: {
      id: null,
      author_name: '',
      author_title: '',
      author_photo_path: '',
      quote: '',
      sort_order: 0,
      is_active: 1,
    },
    errors: [],
    mode: 'new',
  });
};

export const postNewTestimonial = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['testimonials']);
    }
    return res.status(422).render('admin/testimonials/form', {
      title: 'New Testimonial',
      layout: 'layouts/admin',
      testimonial: {
        id: null,
        author_name: req.body.author_name || '',
        author_title: req.body.author_title || '',
        author_photo_path: '',
        quote: req.body.quote || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'new',
    });
  }

  await createTestimonial({
    author_name: req.body.author_name.trim(),
    author_title: (req.body.author_title || '').trim() || null,
    author_photo_path: req.file ? req.file.publicPath : null,
    quote: req.body.quote.trim(),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'Testimonial created.');
  res.redirect('/admin/testimonials');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditTestimonial = async (req, res) => {
  const testimonial = await findTestimonialById(req.params.id);
  if (!testimonial) {
    req.flash('error', 'Testimonial not found.');
    return res.redirect('/admin/testimonials');
  }
  res.render('admin/testimonials/form', {
    title: 'Edit Testimonial',
    layout: 'layouts/admin',
    testimonial,
    errors: [],
    mode: 'edit',
  });
};

export const postEditTestimonial = async (req, res) => {
  const testimonial = await findTestimonialById(req.params.id);
  if (!testimonial) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['testimonials']);
    }
    req.flash('error', 'Testimonial not found.');
    return res.redirect('/admin/testimonials');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    if (req.file && req.file.publicPath) {
      await deleteUploadedFile(req.file.publicPath, ['testimonials']);
    }
    return res.status(422).render('admin/testimonials/form', {
      title: 'Edit Testimonial',
      layout: 'layouts/admin',
      testimonial: {
        ...testimonial,
        author_name: req.body.author_name || testimonial.author_name,
        author_title: req.body.author_title || '',
        quote: req.body.quote || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'edit',
    });
  }

  const oldPhoto = testimonial.author_photo_path;
  const newPhoto = req.file ? req.file.publicPath : oldPhoto;

  await updateTestimonial(testimonial.id, {
    author_name: req.body.author_name.trim(),
    author_title: (req.body.author_title || '').trim() || null,
    author_photo_path: newPhoto,
    quote: req.body.quote.trim(),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  if (req.file && oldPhoto && oldPhoto !== newPhoto) {
    await replaceUploadedFile(oldPhoto, newPhoto, ['testimonials']);
  }

  req.flash('success', 'Testimonial updated.');
  res.redirect('/admin/testimonials');
};

// ─── Admin: toggle ──────────────────────────────────────

export const postToggleTestimonial = async (req, res) => {
  const testimonial = await findTestimonialById(req.params.id);
  if (!testimonial) {
    req.flash('error', 'Testimonial not found.');
    return res.redirect('/admin/testimonials');
  }
  await toggleTestimonialActive(testimonial.id, !testimonial.is_active);
  req.flash('success', 'Testimonial status updated.');
  res.redirect('/admin/testimonials');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteTestimonial = async (req, res) => {
  const testimonial = await findTestimonialById(req.params.id);
  if (!testimonial) {
    req.flash('error', 'Testimonial not found.');
    return res.redirect('/admin/testimonials');
  }

  await deleteTestimonial(testimonial.id);

  if (testimonial.author_photo_path) {
    await deleteUploadedFile(testimonial.author_photo_path, ['testimonials']);
  }

  req.flash('success', 'Testimonial deleted.');
  res.redirect('/admin/testimonials');
};