// src/controllers/apiAuthController.js
// JWT-based auth for the mobile API.
// Member login mirrors postMemberLogin (web); admin login mirrors postLogin (web).
// Returns { accessToken, refreshToken, member|user }.

import {
  findMemberByEmail,
  findMemberById,
  verifyMemberPassword,
  touchMemberLastLogin,
} from '../models/memberModel.js';
import {
  findUserByEmail,
  findUserById,
  verifyPassword,
  touchLastLogin,
} from '../models/userModel.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  pruneExpiredTokens,
} from '../services/jwtService.js';

// ─── Helpers ────────────────────────────────────────────

const asInt = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

const cleanMember = (m) => ({
  id: m.id,
  member_number: m.member_number,
  full_name: m.full_name,
  email: m.email,
  phone: m.phone,
  address: m.address,
  employer: m.employer,
  qualifications: m.qualifications,
  years_experience: m.years_experience,
  photo_path: m.photo_path,
  status: m.status,
  is_verified: m.is_verified,
  tier_id: m.tier_id,
  tier_name: m.tier_name || null,
  tier_slug: m.tier_slug || null,
  joined_at: m.joined_at,
  expires_at: m.expires_at,
  last_login_at: m.last_login_at,
});

const cleanAdmin = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  is_active: u.is_active,
  last_login_at: u.last_login_at,
});

const badRequest = (res, message, code = 'BAD_REQUEST', fieldErrors = null) =>
  res.status(422).json({ error: message, code, ...(fieldErrors ? { errors: fieldErrors } : {}) });

// ─── POST /api/v1/auth/member/login ─────────────────────

export const memberLogin = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return badRequest(res, 'Email and password are required.', 'VALIDATION');
    }

    const member = await findMemberByEmail(email);
    if (!member) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    if (!member.password_hash) {
      return res.status(403).json({
        error: 'Your account is not yet activated. Check your email for the activation link, or reset your password on the website.',
        code: 'NOT_ACTIVATED',
      });
    }

    if (member.status === 'suspended' || member.status === 'cancelled') {
      return res.status(403).json({
        error: `Your membership is ${member.status}. Please contact the Institute.`,
        code: member.status.toUpperCase(),
      });
    }

    const ok = await verifyMemberPassword(password, member.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    const accessToken = signAccessToken('member', member.id);
    const refreshToken = await issueRefreshToken('member', member.id);

    touchMemberLastLogin(member.id).catch((e) =>
      console.error('[api member login] touchLastLogin failed:', e.message)
    );
    pruneExpiredTokens().catch(() => {});

    return res.json({
      accessToken,
      refreshToken,
      member: cleanMember(member),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/admin/login ──────────────────────

export const adminLogin = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return badRequest(res, 'Email and password are required.', 'VALIDATION');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'This admin account has been disabled.', code: 'ACCOUNT_DISABLED' });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
    }

    const accessToken = signAccessToken('admin', user.id, user.role);
    const refreshToken = await issueRefreshToken('admin', user.id);

    touchLastLogin(user.id).catch((e) =>
      console.error('[api admin login] touchLastLogin failed:', e.message)
    );
    pruneExpiredTokens().catch(() => {});

    return res.json({
      accessToken,
      refreshToken,
      user: cleanAdmin(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/refresh ──────────────────────────

export const refresh = async (req, res, next) => {
  try {
    const rawToken = String(req.body?.refreshToken || '');
    if (!rawToken) {
      return badRequest(res, 'refreshToken is required.', 'VALIDATION');
    }

    const rotated = await rotateRefreshToken(rawToken);
    if (!rotated) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.', code: 'INVALID_REFRESH' });
    }

    // Re-load the user so we can return fresh profile + role and enforce active status.
    if (rotated.userType === 'member') {
      const member = await findMemberById(rotated.userId);
      if (!member || member.status === 'suspended' || member.status === 'cancelled') {
        await revokeRefreshToken(rotated.refreshToken);
        return res.status(401).json({ error: 'Your account is no longer active.', code: 'SESSION_REVOKED' });
      }
      const accessToken = signAccessToken('member', member.id);
      return res.json({ accessToken, refreshToken: rotated.refreshToken, member: cleanMember(member) });
    }

    if (rotated.userType === 'admin') {
      const user = await findUserById(rotated.userId);
      if (!user || !user.is_active) {
        await revokeRefreshToken(rotated.refreshToken);
        return res.status(401).json({ error: 'Your account is no longer active.', code: 'SESSION_REVOKED' });
      }
      const accessToken = signAccessToken('admin', user.id, user.role);
      return res.json({ accessToken, refreshToken: rotated.refreshToken, user: cleanAdmin(user) });
    }

    return res.status(400).json({ error: 'Unsupported token type.', code: 'BAD_REQUEST' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/logout ───────────────────────────

export const logout = async (req, res, next) => {
  try {
    const rawToken = String(req.body?.refreshToken || '');
    if (rawToken) await revokeRefreshToken(rawToken);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/member/me (used by client to confirm token) ─

export const memberMe = async (req, res) => {
  // req.member is set by requireMemberJWT
  return res.json({ member: cleanMember(req.member) });
};

// ─── GET /api/v1/admin/me ───────────────────────────────

export const adminMe = async (req, res) => {
  // req.user is set by requireAdminJWT
  return res.json({ user: cleanAdmin(req.user) });
};