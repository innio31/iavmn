// src/models/newsletterModel.js
// Data access for newsletter campaigns and per-recipient tracking.

import { query, withTransaction } from '../db.js';

// ─── Campaigns ──────────────────────────────────────────

/**
 * Create a new campaign in draft status.
 */
export const createSend = async ({ subject, body_html, body_text, created_by, total_recipients = 0 }) => {
  const result = await query(
    `INSERT INTO \`newsletter_sends\`
       (\`subject\`, \`body_html\`, \`body_text\`, \`created_by\`, \`status\`, \`total_recipients\`)
     VALUES (?, ?, ?, ?, 'draft', ?)`,
    [subject, body_html, body_text ?? null, created_by ?? null, total_recipients]
  );
  return result.insertId;
};

/**
 * Find a campaign by id.
 */
export const findSendById = async (id) => {
  const rows = await query('SELECT * FROM `newsletter_sends` WHERE `id` = ? LIMIT 1', [id]);
  return rows.length ? rows[0] : null;
};

/**
 * List all campaigns (newest first).
 */
export const listSends = async (opts = {}) => {
  const { limit = null, offset = 0 } = opts;

  let sql = 'SELECT * FROM `newsletter_sends` ORDER BY `created_at` DESC';
  const params = [];

  if (limit && Number.isFinite(Number(limit))) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
    if (offset) {
      sql += ' OFFSET ?';
      params.push(Number(offset));
    }
  }

  return query(sql, params);
};

/**
 * Count campaigns.
 */
export const countSends = async () => {
  const rows = await query('SELECT COUNT(*) AS n FROM `newsletter_sends`');
  return Number(rows[0].n);
};

/**
 * Update campaign status and counts.
 */
export const updateSendStatus = async (id, {
  status,
  sent_count,
  failed_count,
  started_at,
  completed_at,
}) => {
  const fields = [];
  const params = [];

  if (status !== undefined) { fields.push('`status` = ?'); params.push(status); }
  if (sent_count !== undefined) { fields.push('`sent_count` = ?'); params.push(sent_count); }
  if (failed_count !== undefined) { fields.push('`failed_count` = ?'); params.push(failed_count); }
  if (started_at !== undefined) { fields.push('`started_at` = ?'); params.push(started_at); }
  if (completed_at !== undefined) { fields.push('`completed_at` = ?'); params.push(completed_at); }

  if (!fields.length) return;
  params.push(id);

  await query(`UPDATE \`newsletter_sends\` SET ${fields.join(', ')} WHERE \`id\` = ?`, params);
};

/**
 * Increment counters atomically.
 */
export const incrementSendCounters = async (id, { sent = 0, failed = 0 }) => {
  await query(
    `UPDATE \`newsletter_sends\`
       SET \`sent_count\` = \`sent_count\` + ?,
           \`failed_count\` = \`failed_count\` + ?
     WHERE \`id\` = ?`,
    [sent, failed, id]
  );
};

/**
 * Delete a campaign (and its recipients via FK CASCADE).
 */
export const deleteSend = async (id) => {
  await query('DELETE FROM `newsletter_sends` WHERE `id` = ?', [id]);
};

// ─── Recipients ─────────────────────────────────────────

/**
 * Bulk-insert recipient rows for a campaign.
 * Uses a transaction to keep this fast and atomic.
 */
export const bulkInsertRecipients = async (sendId, subscribers) => {
  if (!subscribers.length) return 0;

  return withTransaction(async (conn) => {
    // Insert one row at a time for compatibility with mysql2's prepared statements.
    // For a few hundred recipients this is fast enough.
    let inserted = 0;
    const sql = `
      INSERT INTO \`newsletter_recipients\`
        (\`send_id\`, \`subscriber_id\`, \`email\`, \`status\`)
      VALUES (?, ?, ?, 'pending')
    `;
    for (const s of subscribers) {
      await conn.query(sql, [sendId, s.id ?? null, s.email]);
      inserted += 1;
    }
    return inserted;
  });
};

/**
 * List recipients for a campaign (for the detail view).
 * @param {object} opts
 * @param {number} opts.limit
 * @param {number} opts.offset
 * @param {string} opts.status  Optional filter: pending | sent | failed
 */
export const listRecipients = async (sendId, opts = {}) => {
  const { limit = null, offset = 0, status = null } = opts;

  let sql = 'SELECT * FROM `newsletter_recipients` WHERE `send_id` = ?';
  const params = [sendId];

  if (status) {
    sql += ' AND `status` = ?';
    params.push(status);
  }

  sql += ' ORDER BY `id` ASC';

  if (limit && Number.isFinite(Number(limit))) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
    if (offset) {
      sql += ' OFFSET ?';
      params.push(Number(offset));
    }
  }

  return query(sql, params);
};

/**
 * Count recipients by status for a campaign.
 */
export const getRecipientCounts = async (sendId) => {
  const rows = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM \`newsletter_recipients\`
     WHERE \`send_id\` = ?`,
    [sendId]
  );
  const r = rows[0] || {};
  return {
    total: Number(r.total || 0),
    pending: Number(r.pending || 0),
    sent: Number(r.sent || 0),
    failed: Number(r.failed || 0),
  };
};

/**
 * Mark a recipient as sent.
 */
export const markRecipientSent = async (recipientId) => {
  await query(
    "UPDATE `newsletter_recipients` SET `status` = 'sent', `sent_at` = NOW() WHERE `id` = ?",
    [recipientId]
  );
};

/**
 * Mark a recipient as failed.
 */
export const markRecipientFailed = async (recipientId, errorMessage) => {
  await query(
    "UPDATE `newsletter_recipients` SET `status` = 'failed', `error_message` = ? WHERE `id` = ?",
    [String(errorMessage || '').slice(0, 500), recipientId]
  );
};

/**
 * Get the next N pending recipients for a campaign.
 * Used by the send loop.
 */
export const getPendingRecipients = async (sendId, limit = 20) => {
  return query(
    `SELECT * FROM \`newsletter_recipients\`
     WHERE \`send_id\` = ? AND \`status\` = 'pending'
     ORDER BY \`id\` ASC
     LIMIT ?`,
    [sendId, Number(limit)]
  );
};