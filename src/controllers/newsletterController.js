// src/controllers/newsletterController.js
// Admin: compose, preview, send, and track newsletter campaigns.

import { body, validationResult } from 'express-validator';
import {
  createSend,
  findSendById,
  listSends,
  countSends,
  updateSendStatus,
  incrementSendCounters,
  deleteSend,
  bulkInsertRecipients,
  listRecipients,
  getRecipientCounts,
  getPendingRecipients,
  markRecipientSent,
  markRecipientFailed,
} from '../models/newsletterModel.js';
import { listSubscribers } from '../models/subscriberModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import { sendMail } from '../services/mailer.js';

// ─── Config ─────────────────────────────────────────────

const BATCH_SIZE = 20;          // recipients per batch
const BATCH_DELAY_MS = 1200;    // pause between batches
const MAX_RECIPIENTS = 2000;    // hard cap per campaign

// ─── Validation ─────────────────────────────────────────

export const composeValidators = [
  body('subject')
    .trim()
    .isLength({ min: 3, max: 250 })
    .withMessage('Subject must be between 3 and 250 characters.'),
  body('body_html')
    .trim()
    .isLength({ min: 10, max: 200000 })
    .withMessage('Message body is required.'),
];

export const testSendValidators = [
  body('test_email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address for the test.'),
];

// ─── Helpers ────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const htmlToText = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ─── Admin: list ────────────────────────────────────────

export const listNewslettersAdmin = async (req, res) => {
  const [sends, total] = await Promise.all([listSends({ limit: 100 }), countSends()]);

  res.render('admin/newsletter/list', {
    title: 'Newsletter',
    layout: 'layouts/admin',
    sends,
    total,
  });
};

// ─── Admin: compose ─────────────────────────────────────

export const showComposeNewsletter = async (req, res) => {
  const subscribers = await listSubscribers(true);

  res.render('admin/newsletter/compose', {
    title: 'Compose Newsletter',
    layout: 'layouts/admin',
    form: { subject: '', body_html: '' },
    errors: [],
    subscriberCount: subscribers.length,
    maxRecipients: MAX_RECIPIENTS,
  });
};

// ─── Admin: send campaign ───────────────────────────────

export const postSendNewsletter = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const subscribers = await listSubscribers(true);
    return res.status(422).render('admin/newsletter/compose', {
      title: 'Compose Newsletter',
      layout: 'layouts/admin',
      form: {
        subject: req.body.subject || '',
        body_html: req.body.body_html || '',
      },
      errors: result.array(),
      subscriberCount: subscribers.length,
      maxRecipients: MAX_RECIPIENTS,
    });
  }

  const subscribers = await listSubscribers(true);
  if (!subscribers.length) {
    req.flash('error', 'There are no active subscribers to send to.');
    return res.redirect('/admin/newsletter');
  }

  const capped = subscribers.slice(0, MAX_RECIPIENTS);
  const subject = req.body.subject.trim();
  const bodyHtml = req.body.body_html.trim();
  const bodyText = htmlToText(bodyHtml);

  const sendId = await createSend({
    subject,
    body_html: bodyHtml,
    body_text: bodyText,
    created_by: req.session.user ? req.session.user.user_id : null,
    total_recipients: capped.length,
  });

  await bulkInsertRecipients(
    sendId,
    capped.map((s) => ({ id: s.id, email: s.email, unsub_token: s.unsub_token }))
  );

  await updateSendStatus(sendId, {
    status: 'sending',
    started_at: new Date(),
  });

  processCampaignInBackground(sendId).catch((err) =>
    console.error('[newsletter bg] failed:', err.message)
  );

  req.flash(
    'success',
    `Sending to ${capped.length} subscriber${capped.length === 1 ? '' : 's'}. Refresh this page to see progress.`
  );
  res.redirect(`/admin/newsletter/${sendId}`);
};

// ─── Admin: detail ──────────────────────────────────────

export const showNewsletterDetail = async (req, res) => {
  const send = await findSendById(req.params.id);
  if (!send) {
    req.flash('error', 'Campaign not found.');
    return res.redirect('/admin/newsletter');
  }

  const [counts, recipients] = await Promise.all([
    getRecipientCounts(send.id),
    listRecipients(send.id, { limit: 500 }),
  ]);

  res.render('admin/newsletter/view', {
    title: 'Newsletter: ' + send.subject,
    layout: 'layouts/admin',
    send,
    counts,
    recipients,
  });
};

// ─── Admin: test send ───────────────────────────────────

export const postSendTest = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    req.flash('error', result.array()[0].msg);
    return res.redirect('/admin/newsletter/new');
  }

  const subject = (req.body.subject || '').trim();
  const bodyHtml = (req.body.body_html || '').trim();
  const testEmail = req.body.test_email.trim();

  if (!subject || !bodyHtml) {
    req.flash('error', 'Add a subject and message before sending a test.');
    return res.redirect('/admin/newsletter/new');
  }

  try {
    const settings = await getAllSettings();
    const baseUrl = (settings.app_url || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

    const r = await sendMail({
      to: testEmail,
      subject: `[TEST] ${subject}`,
      template: 'newsletter',
      data: {
        settings,
        subject,
        bodyHtml,
        subscriber: { email: testEmail },
        unsubscribeUrl: `${baseUrl}/unsubscribe/preview`,
        isTest: true,
      },
    });

    if (r && r.ok) {
      req.flash('success', `Test email sent to ${testEmail}.`);
    } else {
      req.flash('error', `Test send failed: ${(r && r.error) || 'unknown error'}`);
    }
  } catch (err) {
    console.error('[newsletter test] failed:', err.message);
    req.flash('error', 'Test send failed. Check the logs.');
  }

  res.redirect('/admin/newsletter/new');
};

// ─── Admin: delete ──────────────────────────────────────

export const postDeleteNewsletter = async (req, res) => {
  const send = await findSendById(req.params.id);
  if (!send) {
    req.flash('error', 'Campaign not found.');
    return res.redirect('/admin/newsletter');
  }

  await deleteSend(send.id);
  req.flash('success', 'Campaign deleted.');
  res.redirect('/admin/newsletter');
};

// ─── Admin: resume ──────────────────────────────────────

export const postResumeNewsletter = async (req, res) => {
  const send = await findSendById(req.params.id);
  if (!send) {
    req.flash('error', 'Campaign not found.');
    return res.redirect('/admin/newsletter');
  }

  if (send.status === 'sent') {
    req.flash('info', 'This campaign has already finished.');
    return res.redirect(`/admin/newsletter/${send.id}`);
  }

  await updateSendStatus(send.id, { status: 'sending' });
  processCampaignInBackground(send.id).catch((err) =>
    console.error('[newsletter resume] failed:', err.message)
  );

  req.flash('success', 'Campaign resumed.');
  res.redirect(`/admin/newsletter/${send.id}`);
};

// ─── Background batch sender ────────────────────────────

const processCampaignInBackground = async (sendId) => {
  const send = await findSendById(sendId);
  if (!send) return;

  const settings = await getAllSettings();
  const baseUrl = (settings && settings.app_url) || process.env.APP_URL || 'http://localhost:3000';

  // Build a map from email → unsub_token for this campaign.
  // (We look it up from the newsletter_recipients join to subscribers.)
  // Simpler: fetch all active subscribers once and index by email.
  const activeSubs = await listSubscribers(true);
  const tokenByEmail = new Map();
  for (const s of activeSubs) {
    tokenByEmail.set(s.email.toLowerCase(), s.unsub_token);
  }

  let safety = 0;
  const MAX_LOOPS = 500;

  while (safety < MAX_LOOPS) {
    safety += 1;

    const batch = await getPendingRecipients(sendId, BATCH_SIZE);
    if (!batch.length) break;

    const current = await findSendById(sendId);
    if (!current) break;

    for (const r of batch) {
      try {
        const token = tokenByEmail.get(r.email.toLowerCase());
        const unsubscribeUrl = token
          ? `${baseUrl.replace(/\/$/, '')}/unsubscribe/${encodeURIComponent(token)}`
          : `${baseUrl.replace(/\/$/, '')}/contact`;

        const result = await sendMail({
          to: r.email,
          subject: current.subject,
          template: 'newsletter',
          data: {
            settings,
            subject: current.subject,
            bodyHtml: current.body_html,
            subscriber: { email: r.email },
            unsubscribeUrl,
            isTest: false,
          },
        });

        if (result && result.ok) {
          await markRecipientSent(r.id);
          await incrementSendCounters(sendId, { sent: 1 });
        } else {
          await markRecipientFailed(r.id, result.error || 'send failed');
          await incrementSendCounters(sendId, { failed: 1 });
        }
      } catch (err) {
        await markRecipientFailed(r.id, err.message);
        await incrementSendCounters(sendId, { failed: 1 });
      }
    }

    const remaining = await getPendingRecipients(sendId, 1);
    if (remaining.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  const counts = await getRecipientCounts(sendId);
  const finalStatus = counts.failed > 0 && counts.sent === 0 ? 'failed' : 'sent';
  await updateSendStatus(sendId, {
    status: finalStatus,
    completed_at: new Date(),
    sent_count: counts.sent,
    failed_count: counts.failed,
  });

  console.log(
    `[newsletter] campaign ${sendId} finished: sent=${counts.sent}, failed=${counts.failed}`
  );
};