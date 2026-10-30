// src/middleware/apiAuth.js
// JWT route guards for the mobile API. Mirror the web guards but
// return JSON errors instead of redirects.
//
// Every guard re-loads the user on each request — this is what makes
// "suspend/delete a member" revoke mobile sessions instantly, without
// waiting for the access token to expire.

import { verifyAccessToken } from '../services/jwtService.js';
import { findMemberById } from '../models/memberModel.js';
import { findUserById } from '../models/userModel.js';

// ─── Helpers ────────────────────────────────────────────

const extractBearer = (req) => {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
};

const fail = (res, status, code, error) => res.status(status).json({ error, code });

// ─── Member guard ───────────────────────────────────────

/**
 * Require a valid member access token.
 * Sets req.member on success.
 * Returns 401 { code: 'SESSION_REVOKED' } if the member is missing,
 * suspended, cancelled, or expired-status accounts that the web also blocks.
 */
export const requireMemberJWT = async (req, res, next) => {
  try {
    const token = extractBearer(req);
    if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required.');

    const payload = verifyAccessToken(token);
    if (!payload || payload.typ !== 'member' || !payload.sub) {
      return fail(res, 401, 'INVALID_TOKEN', 'Session expired or invalid. Please log in again.');
    }

    const member = await findMemberById(payload.sub);
    if (!member) {
      return fail(res, 401, 'SESSION_REVOKED', 'Your account is no longer available.');
    }

    // Match web loadMember behavior: suspended/cancelled = instant revoke.
    if (member.status === 'suspended' || member.status === 'cancelled') {
      return fail(res, 401, 'SESSION_REVOKED', `Your membership is ${member.status}. Please contact the Institute.`);
    }

    req.member = member;
    return next();
  } catch (err) {
    console.error('[requireMemberJWT] failed:', err.message);
    return fail(res, 500, 'INTERNAL', 'Authentication check failed.');
  }
};

// ─── Admin guard ────────────────────────────────────────

/**
 * Require a valid admin access token.
 * Sets req.user on success.
 * Returns 401 { code: 'SESSION_REVOKED' } if the admin was disabled or deleted.
 */
export const requireAdminJWT = async (req, res, next) => {
  try {
    const token = extractBearer(req);
    if (!token) return fail(res, 401, 'NO_TOKEN', 'Authentication required.');

    const payload = verifyAccessToken(token);
    if (!payload || payload.typ !== 'admin' || !payload.sub) {
      return fail(res, 401, 'INVALID_TOKEN', 'Session expired or invalid. Please log in again.');
    }

    const user = await findUserById(payload.sub);
    if (!user) {
      return fail(res, 401, 'SESSION_REVOKED', 'Your account is no longer available.');
    }
    if (!user.is_active) {
      return fail(res, 403, 'ACCOUNT_DISABLED', 'Your admin account has been disabled.');
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('[requireAdminJWT] failed:', err.message);
    return fail(res, 500, 'INTERNAL', 'Authentication check failed.');
  }
};

// ─── Role guard ─────────────────────────────────────────

/**
 * Require one of the given admin roles. Use AFTER requireAdminJWT.
 * Usage: router.get('/x', requireAdminJWT, requireAdminRole('super_admin'), handler)
 */
export const requireAdminRole = (...roles) => (req, res, next) => {
  const user = req.user;
  if (!user) return fail(res, 401, 'NO_TOKEN', 'Authentication required.');
  if (!roles.includes(user.role)) {
    return fail(res, 403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }
  return next();
};