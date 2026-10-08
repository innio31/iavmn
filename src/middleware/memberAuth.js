// src/middleware/memberAuth.js
// Member portal authentication guards.
//
// Uses a separate session key (member) so admin and member sessions
// can coexist without interfering — an admin can be logged in as admin
// while also testing the member portal in the same browser.

import { findMemberById } from '../models/memberModel.js';

/**
 * Load the current member (if any) into req.member and res.locals.currentMember.
 * Runs on every request. Never blocks — always calls next().
 */
export const loadMember = async (req, res, next) => {
  try {
    const memberId = req.session?.member?.id;
    if (!memberId) {
      res.locals.currentMember = null;
      req.member = null;
      return next();
    }

    const member = await findMemberById(memberId);
    if (!member) {
      // Session references a member that no longer exists — clear it
      delete req.session.member;
      res.locals.currentMember = null;
      req.member = null;
      return next();
    }

    // Also clear session if the member has been deactivated
    if (member.status === 'suspended' || member.status === 'cancelled') {
      delete req.session.member;
      res.locals.currentMember = null;
      req.member = null;
      return next();
    }

    req.member = member;
    res.locals.currentMember = member;
    return next();
  } catch (err) {
    console.error('[loadMember] failed:', err.message);
    res.locals.currentMember = null;
    req.member = null;
    return next();
  }
};

/**
 * Require a logged-in member. Redirects to /member/login if not signed in.
 * Preserves the originally requested URL.
 */
export const requireMemberLogin = (req, res, next) => {
  if (req.member) return next();
  const redirectTo = encodeURIComponent(req.originalUrl || '/member');
  req.flash('error', 'Please log in to access the member portal.');
  return res.redirect(`/member/login?next=${redirectTo}`);
};

/**
 * Require that the visitor is NOT logged in as a member.
 * Used on /member/login and /member/forgot-password.
 */
export const requireMemberGuest = (req, res, next) => {
  if (req.member) return res.redirect('/member');
  return next();
};