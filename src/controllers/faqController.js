// src/controllers/faqController.js
// Admin + public: FAQs.

import { body, validationResult } from 'express-validator';
import {
  listFaqs,
  findFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  toggleFaqActive,
} from '../models/faqModel.js';

// ─── Validation ─────────────────────────────────────────

export const faqValidators = [
  body('question')
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Question must be between 3 and 300 characters.'),
  body('answer')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Answer is required (at least 3 characters).'),
  body('sort_order')
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: 9999 })
    .withMessage('Display order must be a number between 0 and 9999.'),
];

// ─── Admin: list ────────────────────────────────────────

export const listFaqsAdmin = async (req, res) => {
  const faqs = await listFaqs(false);
  res.render('admin/faqs/list', {
    title: 'FAQs',
    layout: 'layouts/admin',
    faqs,
  });
};

// ─── Admin: new ─────────────────────────────────────────

export const showNewFaq = (req, res) => {
  res.render('admin/faqs/form', {
    title: 'New FAQ',
    layout: 'layouts/admin',
    faq: {
      id: null,
      question: '',
      answer: '',
      sort_order: 0,
      is_active: 1,
    },
    errors: [],
    mode: 'new',
  });
};

export const postNewFaq = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('admin/faqs/form', {
      title: 'New FAQ',
      layout: 'layouts/admin',
      faq: {
        id: null,
        question: req.body.question || '',
        answer: req.body.answer || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'new',
    });
  }

  await createFaq({
    question: req.body.question.trim(),
    answer: req.body.answer.trim(),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'FAQ created.');
  res.redirect('/admin/faqs');
};

// ─── Admin: edit ────────────────────────────────────────

export const showEditFaq = async (req, res) => {
  const faq = await findFaqById(req.params.id);
  if (!faq) {
    req.flash('error', 'FAQ not found.');
    return res.redirect('/admin/faqs');
  }
  res.render('admin/faqs/form', {
    title: 'Edit FAQ',
    layout: 'layouts/admin',
    faq,
    errors: [],
    mode: 'edit',
  });
};

export const postEditFaq = async (req, res) => {
  const faq = await findFaqById(req.params.id);
  if (!faq) {
    req.flash('error', 'FAQ not found.');
    return res.redirect('/admin/faqs');
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).render('admin/faqs/form', {
      title: 'Edit FAQ',
      layout: 'layouts/admin',
      faq: {
        ...faq,
        question: req.body.question || faq.question,
        answer: req.body.answer || '',
        sort_order: Number(req.body.sort_order) || 0,
        is_active: req.body.is_active ? 1 : 0,
      },
      errors: result.array(),
      mode: 'edit',
    });
  }

  await updateFaq(faq.id, {
    question: req.body.question.trim(),
    answer: req.body.answer.trim(),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: req.body.is_active ? 1 : 0,
  });

  req.flash('success', 'FAQ updated.');
  res.redirect('/admin/faqs');
};

// ─── Admin: toggle ──────────────────────────────────────

export const postToggleFaq = async (req, res) => {
  const faq = await findFaqById(req.params.id);
  if (!faq) {
    req.flash('error', 'FAQ not found.');
    return res.redirect('/admin/faqs');
  }
  await toggleFaqActive(faq.id, !faq.is_active);
  req.flash('success', 'FAQ status updated.');
  res.redirect('/admin/faqs');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteFaq = async (req, res) => {
  const faq = await findFaqById(req.params.id);
  if (!faq) {
    req.flash('error', 'FAQ not found.');
    return res.redirect('/admin/faqs');
  }
  await deleteFaq(faq.id);
  req.flash('success', 'FAQ deleted.');
  res.redirect('/admin/faqs');
};

// ─── Public: FAQ page ───────────────────────────────────

export const publicFaqPage = async (req, res) => {
  const faqs = await listFaqs(true);
  res.render('faq', {
    title: 'Frequently Asked Questions',
    faqs,
  });
};