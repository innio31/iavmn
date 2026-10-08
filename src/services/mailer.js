// src/services/mailer.js
// Centralized email service built on Nodemailer.

import 'dotenv/config';
import nodemailer from 'nodemailer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'views', 'emails');

// ─── Config detection ───────────────────────────────────

const isConfigured = () => {
  const host = (process.env.MAIL_HOST || '').trim();
  const user = (process.env.MAIL_USER || '').trim();
  const pass = (process.env.MAIL_PASS || '').trim();
  return Boolean(host && user && pass);
};

// ─── Transporter (lazy) ─────────────────────────────────

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!isConfigured()) return null;

  const port = Number(process.env.MAIL_PORT) || 465;
  const secure = String(process.env.MAIL_SECURE).toLowerCase() === 'true';
  const host = process.env.MAIL_HOST;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
      servername: host,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  return transporter;
};

// ─── Template rendering ─────────────────────────────────

/**
 * Render an EJS email template from src/views/emails/.
 * Automatically injects `appUrl` so templates don't need to read process.env.
 */
export const renderEmail = async (templateName, data = {}) => {
  const file = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
  const source = await fs.readFile(file, 'utf8');

  // Inject appUrl into the template data. Prefer process.env.APP_URL,
  // fall back to a reasonable default.
  const envAppUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '');
  const injected = {
    ...data,
    appUrl: envAppUrl || 'http://localhost:3000',
  };

  return ejs.render(source, injected, { filename: file });
};

// ─── Send ───────────────────────────────────────────────

export const sendMail = async (opts) => {
  const {
    to,
    subject,
    html: providedHtml,
    text,
    replyTo,
    template,
    data = {},
  } = opts;

  const fromName = process.env.MAIL_FROM_NAME || 'IAVMN';
  const fromEmail = process.env.MAIL_FROM_EMAIL || 'no-reply@iavmn.org';
  const from = `"${fromName}" <${fromEmail}>`;

  let html = providedHtml || null;
  if (!html && template) {
    try {
      html = await renderEmail(template, data);
    } catch (err) {
      console.error('[mailer] template render failed:', template, err.message);
      return { ok: false, error: 'Template render failed' };
    }
  }

  const recipients = Array.isArray(to) ? to.join(', ') : to;

  if (!isConfigured()) {
    console.log('\n══════════════ [mailer: dev] Email not sent — SMTP not configured ══════════════');
    console.log('  To:      ', recipients);
    console.log('  Subject: ', subject);
    if (replyTo) console.log('  Reply-To:', replyTo);
    console.log('  Template:', template || '(inline html)');
    if (html) {
      console.log('  HTML preview (first 300 chars):');
      console.log('  ' + html.slice(0, 300).replace(/\s+/g, ' ') + (html.length > 300 ? '…' : ''));
    }
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    return { ok: true, skipped: true };
  }

  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from,
      to: recipients,
      subject,
      html,
      text: text || undefined,
      replyTo: replyTo || undefined,
    });
    console.log('[mailer] sent:', info.messageId, '→', recipients);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] send failed:', err.code || '', err.message);
    if (['EAUTH', 'ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code)) {
      transporter = null;
    }
    return { ok: false, error: err.message };
  }
};

export const mailerIsConfigured = () => isConfigured();