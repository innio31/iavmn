// src/controllers/contactController.js
// Public: contact page (form), submission handling.
// Admin: inbox (list, view, mark read, mark all read, delete).

import { body, validationResult } from 'express-validator';
import {
  listMessages,
  countMessages,
  findMessageById,
  createMessage,
  setMessageRead,
  deleteMessage,
  markAllAsRead,
} from '../models/contactModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { sendMail } from '../services/mailer.js';
import { emit } from '../services/eventBus.js';
import { clearCountsCache } from '../middleware/notificationCounts.js';

// ─── Validation ─────────────────────────────────────────

export const contactValidators = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .isLength({ max: 180 })
    .withMessage('Email is too long.'),
  body('phone')
    .optional({ checkFalsy: true })
    .isLength({ max: 40 })
    .withMessage('Phone number is too long.'),
  body('subject')
    .optional({ checkFalsy: true })
    .isLength({ max: 200 })
    .withMessage('Subject cannot exceed 200 characters.'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters.'),
];

// ─── Public: show contact page ──────────────────────────

export const showContactPage = (req, res) => {
  res.render('contact', {
    title: 'Contact Us',
    form: {
      name: (req.session.user && req.session.user.name) || '',
      email: (req.session.user && req.session.user.email) || '',
      phone: '',
      subject: '',
      message: '',
    },
    errors: [],
  });
};

// ─── Public: POST /contact ──────────────────────────────

export const postContact = async (req, res) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(422).render('contact', {
      title: 'Contact Us',
      form: {
        name: req.body.name || '',
        email: req.body.email || '',
        phone: req.body.phone || '',
        subject: req.body.subject || '',
        message: req.body.message || '',
      },
      errors: result.array(),
    });
  }

  const messageId = await createMessage({
    name: req.body.name.trim(),
    email: req.body.email.trim().toLowerCase(),
    phone: (req.body.phone || '').trim() || null,
    subject: (req.body.subject || '').trim() || null,
    message: req.body.message.trim(),
  });

  // Invalidate cached counts so the sidebar badge updates
  clearCountsCache();

  // Notify connected admin dashboards in real time
  try {
    const savedMessage = await findMessageById(messageId);
    emit('message:new', {
      id: savedMessage.id,
      name: savedMessage.name,
      email: savedMessage.email,
      subject: savedMessage.subject || null,
      preview: (savedMessage.message || '').slice(0, 120),
      created_at: savedMessage.created_at,
    });
  } catch (err) {
    console.error('[contact] emit failed:', err.message);
  }

  // Fire off emails — never block the user flow on mail errors
  try {
    const savedMessage = await findMessageById(messageId);
    const settings = await getAllSettings();

    const recipient =
      (settings.mail_admin_recipient && settings.mail_admin_recipient.trim()) ||
      (settings.contact_email && settings.contact_email.trim()) ||
      process.env.MAIL_FROM_EMAIL ||
      null;

    if (recipient) {
      await sendMail({
        to: recipient,
        replyTo: savedMessage.email,
        subject: `New contact message from ${savedMessage.name}`,
        template: 'contact-notification',
        data: {
          message: savedMessage,
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });
    } else {
      console.warn('[contact] No admin recipient configured — skipping notification.');
    }

    await sendMail({
      to: savedMessage.email,
      subject: 'We received your message',
      template: 'contact-acknowledgement',
      data: {
        message: savedMessage,
        appName: process.env.APP_NAME || 'IAVMN',
        settings,
      },
    });
  } catch (err) {
    console.error('[contact] email dispatch failed:', err.message);
  }

  req.flash('success', 'Thank you for your message. We will get back to you shortly.');
  res.redirect('/contact');
};

// ─── Admin: inbox ───────────────────────────────────────

export const listMessagesAdmin = async (req, res) => {
  const filter = req.query.filter === 'unread' ? 'unread' : 'all';

  const [messages, unreadCount, totalCount] = await Promise.all([
    listMessages({ unreadOnly: filter === 'unread' }),
    countMessages(true),
    countMessages(false),
  ]);

  res.render('admin/messages/list', {
    title: 'Contact Messages',
    layout: 'layouts/admin',
    messages,
    unreadCount,
    totalCount,
    filter,
  });
};

// ─── Admin: view single message ─────────────────────────

export const showMessageAdmin = async (req, res) => {
  const message = await findMessageById(req.params.id);
  if (!message) {
    req.flash('error', 'Message not found.');
    return res.redirect('/admin/messages');
  }

  if (!message.is_read) {
    await setMessageRead(message.id, true);
    message.is_read = 1;
    clearCountsCache();
  }

  res.render('admin/messages/view', {
    title: 'Message from ' + message.name,
    layout: 'layouts/admin',
    message,
  });
};

// ─── Admin: toggle read ─────────────────────────────────

export const postToggleMessage = async (req, res) => {
  const message = await findMessageById(req.params.id);
  if (!message) {
    req.flash('error', 'Message not found.');
    return res.redirect('/admin/messages');
  }
  await setMessageRead(message.id, !message.is_read);
  clearCountsCache();
  req.flash('success', 'Message status updated.');
  res.redirect(req.get('Referer') || '/admin/messages');
};

// ─── Admin: mark all as read ────────────────────────────

export const postMarkAllRead = async (req, res) => {
  await markAllAsRead();
  clearCountsCache();
  req.flash('success', 'All messages marked as read.');
  res.redirect('/admin/messages');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteMessage = async (req, res) => {
  const message = await findMessageById(req.params.id);
  if (!message) {
    req.flash('error', 'Message not found.');
    return res.redirect('/admin/messages');
  }
  await deleteMessage(message.id);
  clearCountsCache();
  req.flash('success', 'Message deleted.');
  res.redirect('/admin/messages');
};