// src/middleware/notificationCounts.js
// Injects unread message counts, pending application counts, etc.
// into res.locals.counts for every request.
//
// Uses a short in-memory cache so admin pages don't hammer the DB.
// Only runs when a user is logged in.

import { countMessages } from '../models/contactModel.js';
import { getApplicationCounts } from '../models/applicationModel.js';

const CACHE_TTL_MS = 30 * 1000; // 30 seconds

let cache = { data: null, loadedAt: 0 };

/**
 * Invalidate the cache — call this from any controller that changes
 * a count (e.g. marking a message read, updating an application status).
 */
export const clearCountsCache = () => {
  cache = { data: null, loadedAt: 0 };
};

/**
 * Compute fresh counts from the DB.
 */
const computeCounts = async () => {
  const [unreadMessages, appCounts] = await Promise.all([
    countMessages(true),
    getApplicationCounts(),
  ]);

  return {
    unreadMessages,
    totalMessages: appCounts.total !== undefined ? undefined : undefined,
    applicationsSubmitted: appCounts.submitted,
    applicationsUnderReview: appCounts.under_review,
    applicationsApproved: appCounts.approved,
    applicationsRejected: appCounts.rejected,
    applicationsPaid: appCounts.paid,
    applicationsTotal: appCounts.total,
    // Convenience: applications that need admin attention
    applicationsActionable: appCounts.submitted,
  };
};

/**
 * Middleware: attaches res.locals.counts.
 * Runs only for logged-in users; guests get zeros.
 */
const notificationCounts = async (req, res, next) => {
  const user = req.session?.user;

  if (!user) {
    res.locals.counts = {
      unreadMessages: 0,
      applicationsSubmitted: 0,
      applicationsUnderReview: 0,
      applicationsApproved: 0,
      applicationsRejected: 0,
      applicationsPaid: 0,
      applicationsTotal: 0,
      applicationsActionable: 0,
    };
    return next();
  }

  try {
    const now = Date.now();
    if (!cache.data || now - cache.loadedAt > CACHE_TTL_MS) {
      cache.data = await computeCounts();
      cache.loadedAt = now;
    }
    res.locals.counts = cache.data;
  } catch (err) {
    console.error('[notificationCounts] failed:', err.message);
    res.locals.counts = {
      unreadMessages: 0,
      applicationsSubmitted: 0,
      applicationsUnderReview: 0,
      applicationsApproved: 0,
      applicationsRejected: 0,
      applicationsPaid: 0,
      applicationsTotal: 0,
      applicationsActionable: 0,
    };
  }

  next();
};

export default notificationCounts;