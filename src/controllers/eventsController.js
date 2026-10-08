// src/controllers/eventsController.js
// Polling endpoint for admin notifications.
// Replaces the earlier SSE approach because HostAfrica's LiteSpeed proxy
// buffers SSE responses and prevents real-time streaming.

import { query } from '../db.js';

/**
 * GET /admin/events/poll
 * Returns the most recent events since a given timestamp.
 *
 * Query params:
 *   since  — ISO timestamp (optional). If provided, only returns items created after this time.
 *   limit  — max items per category (default 20, cap 50)
 */
export const pollEvents = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const sinceRaw = typeof req.query.since === 'string' ? req.query.since.trim() : '';
    const since = sinceRaw ? new Date(sinceRaw) : null;

    // If the client sends an invalid date, fall back to "last 5 minutes"
    const sinceValid = since && !Number.isNaN(since.getTime());
    const cutoffDate = sinceValid ? since : new Date(Date.now() - 5 * 60 * 1000);
    const cutoff = toMysqlDateTime(cutoffDate);

    const [messages, applications, payments] = await Promise.all([
      fetchRecentMessages(cutoff, limit),
      fetchRecentApplications(cutoff, limit),
      fetchRecentPayments(cutoff, limit),
    ]);

    res.json({
      ok: true,
      since: cutoffDate.toISOString(),
      now: new Date().toISOString(),
      events: {
        messages,
        applications,
        payments,
      },
    });
  } catch (err) {
    console.error('[events poll] failed:', err.message);
    res.status(500).json({ ok: false, error: 'Poll failed' });
  }
};

// ─── Helpers ────────────────────────────────────────────

/**
 * Convert a JS Date to MySQL DATETIME string (UTC).
 */
const toMysqlDateTime = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    '-' + pad(date.getUTCMonth() + 1) +
    '-' + pad(date.getUTCDate()) +
    ' ' + pad(date.getUTCHours()) +
    ':' + pad(date.getUTCMinutes()) +
    ':' + pad(date.getUTCSeconds())
  );
};

/**
 * Recent unread contact messages.
 */
const fetchRecentMessages = async (cutoff, limit) => {
  const rows = await query(
    `SELECT id, name, email, subject, LEFT(message, 120) AS preview, created_at
     FROM contact_messages
     WHERE created_at > ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [cutoff, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    subject: r.subject,
    preview: r.preview,
    created_at: r.created_at,
  }));
};

/**
 * Recent membership applications (any status).
 */
const fetchRecentApplications = async (cutoff, limit) => {
  const rows = await query(
    `SELECT a.id, a.reference, a.full_name, a.email, a.status, a.payment_status, a.created_at,
            t.name AS tier_name
     FROM membership_applications a
     LEFT JOIN membership_tiers t ON t.id = a.tier_id
     WHERE a.created_at > ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [cutoff, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    full_name: r.full_name,
    email: r.email,
    status: r.status,
    payment_status: r.payment_status,
    tier_name: r.tier_name,
    created_at: r.created_at,
  }));
};

/**
 * Recent payments (marked paid in the last window).
 */
const fetchRecentPayments = async (cutoff, limit) => {
  const rows = await query(
    `SELECT a.id, a.reference, a.full_name, a.payment_amount, a.payment_currency,
            a.payment_paid_at, a.payment_reference,
            t.name AS tier_name
     FROM membership_applications a
     LEFT JOIN membership_tiers t ON t.id = a.tier_id
     WHERE a.payment_status = 'paid'
       AND a.payment_paid_at IS NOT NULL
       AND a.payment_paid_at > ?
     ORDER BY a.payment_paid_at DESC
     LIMIT ?`,
    [cutoff, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    full_name: r.full_name,
    amount: r.payment_amount,
    currency: r.payment_currency,
    paid_at: r.payment_paid_at,
    payment_reference: r.payment_reference,
    tier_name: r.tier_name,
  }));
};