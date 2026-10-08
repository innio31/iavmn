// src/controllers/subscriberController.js
// Public: subscribe, unsubscribe by token.
// Admin: list, toggle, delete, export CSV.

import { body, validationResult } from 'express-validator';
import {
  listSubscribers,
  countSubscribers,
  findSubscriberByToken,
  findSubscriberById,
  subscribe,
  unsubscribeById,
  deleteSubscriber,
  toggleSubscriberActive,
  exportActiveSubscribers,
} from '../models/subscriberModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { sendMail } from '../services/mailer.js';
import { emit } from '../services/eventBus.js';
import { clearCountsCache } from '../middleware/notificationCounts.js';

// ─── Validation ─────────────────────────────────────────

export const subscribeValidators = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .isLength({ max: 180 })
    .withMessage('Email is too long.'),
];

// ─── Public: POST /subscribe ────────────────────────────

export const postSubscribe = async (req, res) => {
  const result = validationResult(req);
  const referer = req.get('Referer') || '/';

  if (!result.isEmpty()) {
    req.flash('error', result.array()[0].msg);
    return res.redirect(referer);
  }

  const { email } = req.body;
  const outcome = await subscribe(email);

  // Only emit + send welcome if this is a new or reactivated subscriber
  if (outcome.created || outcome.reactivated) {
    try {
      const subscriber = await findSubscriberById(outcome.id);

      // Real-time event for admin dashboards
      emit('subscriber:new', {
        id: subscriber.id,
        email: subscriber.email,
        reactivated: Boolean(outcome.reactivated),
        subscribed_at: subscriber.subscribed_at,
      });

      // Welcome email
      const settings = await getAllSettings();
      if (subscriber) {
        await sendMail({
          to: subscriber.email,
          subject: 'Welcome to the IAVMN newsletter',
          template: 'subscriber-welcome',
          data: {
            subscriber,
            appName: process.env.APP_NAME || 'IAVMN',
            settings,
          },
        });
      }
    } catch (err) {
      console.error('[subscribe] post-subscribe actions failed:', err.message);
    }
  }

  // Invalidate cached counts (sidebar badge)
  clearCountsCache();

  if (outcome.created) {
    req.flash('success', 'Thank you for subscribing to our newsletter!');
  } else if (outcome.reactivated) {
    req.flash('success', 'Welcome back! Your subscription has been restored.');
  } else {
    req.flash('info', 'You are already subscribed to our newsletter.');
  }

  return res.redirect(referer);
};

// ─── Public: GET /unsubscribe/:token ────────────────────

export const publicUnsubscribe = async (req, res) => {
  const token = req.params.token;
  const subscriber = await findSubscriberByToken(token);

  if (!subscriber) {
    return res.status(404).render('errors/404', { title: 'Invalid unsubscribe link' });
  }

  if (subscriber.is_active) {
    await unsubscribeById(subscriber.id);
    clearCountsCache();
  }

  res.render('unsubscribe', {
    title: 'Unsubscribed',
    email: subscriber.email,
  });
};

// ─── Admin: list ────────────────────────────────────────

export const listSubscribersAdmin = async (req, res) => {
  const [subscribers, totalActive, totalAll] = await Promise.all([
    listSubscribers(false),
    countSubscribers(true),
    countSubscribers(false),
  ]);

  res.render('admin/subscribers/list', {
    title: 'Newsletter Subscribers',
    layout: 'layouts/admin',
    subscribers,
    totalActive,
    totalAll,
  });
};

// ─── Admin: toggle ──────────────────────────────────────

export const postToggleSubscriber = async (req, res) => {
  const sub = await findSubscriberById(req.params.id);
  if (!sub) {
    req.flash('error', 'Subscriber not found.');
    return res.redirect('/admin/subscribers');
  }
  await toggleSubscriberActive(sub.id, !sub.is_active);
  clearCountsCache();
  req.flash('success', 'Subscriber status updated.');
  res.redirect('/admin/subscribers');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteSubscriber = async (req, res) => {
  const sub = await findSubscriberById(req.params.id);
  if (!sub) {
    req.flash('error', 'Subscriber not found.');
    return res.redirect('/admin/subscribers');
  }
  await deleteSubscriber(sub.id);
  clearCountsCache();
  req.flash('success', 'Subscriber deleted.');
  res.redirect('/admin/subscribers');
};

// ─── Admin: export CSV ──────────────────────────────────

export const exportSubscribersCsv = async (req, res) => {
  const rows = await exportActiveSubscribers();

  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = ['email,subscribed_at'];
  for (const r of rows) {
    const date = r.subscribed_at ? new Date(r.subscribed_at).toISOString() : '';
    lines.push(`${esc(r.email)},${esc(date)}`);
  }
  const csv = lines.join('\r\n');

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="subscribers-${stamp}.csv"`);
  res.send(csv);
};