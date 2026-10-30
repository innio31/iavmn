// src/services/jwtService.js
// JWT signing/verification + refresh-token lifecycle (hashed in DB).
// Access tokens are stateless JWTs; refresh tokens are opaque random strings
// whose SHA-256 hash is stored in the refresh_tokens table.

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

// ─── Config ─────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRY = process.env.JWT_EXPIRY || '7d';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

if (!JWT_SECRET) {
  // Fail fast at boot — a missing secret would silently issue weak tokens.
  throw new Error('[jwtService] JWT_SECRET is not set in .env');
}

// ─── Helpers ────────────────────────────────────────────

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const addDuration = (spec) => {
  // Parse simple durations like "7d", "30d", "12h", "60m" → Date
  const m = String(spec).trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) throw new Error(`[jwtService] Invalid duration: ${spec}`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms =
    unit === 's' ? n * 1000 :
    unit === 'm' ? n * 60 * 1000 :
    unit === 'h' ? n * 60 * 60 * 1000 :
                  n * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
};

// ─── Access tokens ──────────────────────────────────────

/**
 * Sign a short-lived access token.
 * @param {'member'|'admin'} userType
 * @param {number} userId
 * @param {string|null} role  admin role, null for members
 */
export const signAccessToken = (userType, userId, role = null) => {
  const payload = {
    sub: userId,
    typ: userType,
    ...(role ? { role } : {}),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
};

/**
 * Verify an access token.
 * Returns the decoded payload, or null if invalid/expired.
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

// ─── Refresh tokens ─────────────────────────────────────

/**
 * Issue a new refresh token, persist its hash, and return the raw string.
 * @param {'member'|'admin'} userType
 * @param {number} userId
 * @returns {Promise<string>} raw token (give to client)
 */
export const issueRefreshToken = async (userType, userId) => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = sha256(raw);
  const expiresAt = addDuration(REFRESH_EXPIRY);

  await query(
    `INSERT INTO refresh_tokens (token_hash, user_type, user_id, expires_at)
     VALUES (?, ?, ?, ?)`,
    [hash, userType, userId, expiresAt]
  );

  return raw;
};

/**
 * Rotate a refresh token: validate the old one, revoke it, issue a new one.
 * Returns { userType, userId, refreshToken } or null if invalid/expired/revoked.
 */
export const rotateRefreshToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const hash = sha256(rawToken);
  const rows = await query(
    `SELECT id, user_type, user_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
    [hash]
  );
  if (!rows.length) return null;

  const row = rows[0];
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Revoke the old one immediately (single-use rotation).
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [row.id]);

  const newRaw = await issueRefreshToken(row.user_type, row.user_id);
  return {
    userType: row.user_type,
    userId: row.user_id,
    refreshToken: newRaw,
  };
};

/**
 * Revoke a single refresh token (logout). Safe if token not found.
 */
export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return;
  const hash = sha256(rawToken);
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
    [hash]
  );
};

/**
 * Revoke ALL refresh tokens for a user (e.g. on suspend/delete).
 */
export const revokeAllForUser = async (userType, userId) => {
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_type = ? AND user_id = ? AND revoked_at IS NULL',
    [userType, userId]
  );
};

/**
 * Housekeeping: delete expired/revoked rows older than N days.
 * Call from a cron or on login — cheap enough either way.
 */
export const pruneExpiredTokens = async (olderThanDays = 7) => {
  await query(
    `DELETE FROM refresh_tokens
     WHERE (revoked_at IS NOT NULL OR expires_at < NOW())
       AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [olderThanDays]
  );
};