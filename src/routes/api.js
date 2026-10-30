// src/routes/api.js
// All /api/v1/* routes. Mounted from src/routes.js BEFORE the web router
// so it takes precedence over the /:slug catch-all.
//
// Response shapes are documented inline next to each route.

import { Router } from 'express';
import {
  requireMemberJWT,
  requireAdminJWT,
} from '../middleware/apiAuth.js';
import { apiNotFound, apiErrorHandler } from '../middleware/apiErrorHandler.js';

import {
  memberLogin,
  adminLogin,
  refresh,
  logout,
  memberMe,
  adminMe,
} from '../controllers/apiAuthController.js';

import {
  getMe,
  patchMe,
  changePassword,
  listPayments,
  downloadCertificate,
  getCertificateQr,
} from '../controllers/apiMemberController.js';

import {
  getDashboard,
  listApplicationsAdmin,
  getApplicationAdmin,
  updateApplicationStatusAdmin,
  resendWelcomeAdmin,
  listMembersAdmin,
  getMemberAdmin,
  patchMemberAdmin,
  setMemberStatusAdmin,
  sendMemberResetAdmin,
  setMemberPasswordAdmin,
  listMessagesAdmin,
  getMessageAdmin,
  toggleMessageReadAdmin,
  listSubscribersAdmin,
  exportSubscribersCsvAdmin,
} from '../controllers/apiAdminController.js';

import {
  verifyMember,
  publicTiers,
} from '../controllers/apiPublicController.js';

const api = Router();

// ─── Health ─────────────────────────────────────────────
api.get('/health', (req, res) =>
  res.json({ ok: true, version: 'v1', time: new Date().toISOString() })
);

// ─── Auth (no token required) ───────────────────────────
// POST /api/v1/auth/member/login → { accessToken, refreshToken, member }
api.post('/auth/member/login', memberLogin);
// POST /api/v1/auth/admin/login  → { accessToken, refreshToken, user }
api.post('/auth/admin/login', adminLogin);
// POST /api/v1/auth/refresh      → { accessToken, refreshToken, member|user }
api.post('/auth/refresh', refresh);
// POST /api/v1/auth/logout       → { ok: true }
api.post('/auth/logout', logout);

// ─── Member (JWT required) ──────────────────────────────
// GET   /api/v1/member/me                → { member }
api.get('/member/me', requireMemberJWT, getMe);
// PATCH /api/v1/member/me                → { member }
api.patch('/member/me', requireMemberJWT, patchMe);
// POST  /api/v1/member/change-password   → { ok, message }
api.post('/member/change-password', requireMemberJWT, changePassword);
// GET   /api/v1/member/payments          → { payments[], totalPaid, currency }
api.get('/member/payments', requireMemberJWT, listPayments);
// GET   /api/v1/member/certificate.pdf   → PDF stream
api.get('/member/certificate.pdf', requireMemberJWT, downloadCertificate);
// GET   /api/v1/member/certificate/qr.png → PNG
api.get('/member/certificate/qr.png', requireMemberJWT, getCertificateQr);

// ─── Admin (JWT + role check inside handlers where needed) ─
// GET /api/v1/admin/me → { user }
api.get('/admin/me', requireAdminJWT, adminMe);

// GET /api/v1/admin/dashboard → { applications, members, messages, subscribers, recent_applications }
api.get('/admin/dashboard', requireAdminJWT, getDashboard);

// Applications
// GET  /api/v1/admin/applications?status=&payment= → { applications[], filters }
api.get('/admin/applications', requireAdminJWT, listApplicationsAdmin);
// GET  /api/v1/admin/applications/:id → { application, member|null }
api.get('/admin/applications/:id', requireAdminJWT, getApplicationAdmin);
// POST /api/v1/admin/applications/:id/status { status, adminNotes } → { ok, message, application|member }
api.post('/admin/applications/:id/status', requireAdminJWT, updateApplicationStatusAdmin);
// POST /api/v1/admin/applications/:id/resend-welcome → { ok, message }
api.post('/admin/applications/:id/resend-welcome', requireAdminJWT, resendWelcomeAdmin);

// Members
// GET   /api/v1/admin/members?status=&tier= → { members[], filters }
api.get('/admin/members', requireAdminJWT, listMembersAdmin);
// GET   /api/v1/admin/members/:id → { member, application|null }
api.get('/admin/members/:id', requireAdminJWT, getMemberAdmin);
// PATCH /api/v1/admin/members/:id { tier_id?, status?, expires_at?, notes? } → { ok, member }
api.patch('/admin/members/:id', requireAdminJWT, patchMemberAdmin);
// POST  /api/v1/admin/members/:id/status { next_status } → { ok, member }
api.post('/admin/members/:id/status', requireAdminJWT, setMemberStatusAdmin);
// POST  /api/v1/admin/members/:id/send-reset → { ok, message }
api.post('/admin/members/:id/send-reset', requireAdminJWT, sendMemberResetAdmin);
// POST  /api/v1/admin/members/:id/password { new_password } → { ok, message }
api.post('/admin/members/:id/password', requireAdminJWT, setMemberPasswordAdmin);

// Messages
// GET  /api/v1/admin/messages?filter=unread|all → { messages[], unread, total, filter }
api.get('/admin/messages', requireAdminJWT, listMessagesAdmin);
// GET  /api/v1/admin/messages/:id (auto-marks read) → { message }
api.get('/admin/messages/:id', requireAdminJWT, getMessageAdmin);
// POST /api/v1/admin/messages/:id/toggle { is_read? } → { ok, is_read }
api.post('/admin/messages/:id/toggle', requireAdminJWT, toggleMessageReadAdmin);

// Subscribers
// GET /api/v1/admin/subscribers?active=1 → { subscribers[], active, total }
api.get('/admin/subscribers', requireAdminJWT, listSubscribersAdmin);
// GET /api/v1/admin/subscribers/export.csv → CSV attachment
api.get('/admin/subscribers/export.csv', requireAdminJWT, exportSubscribersCsvAdmin);

// ─── Public ─────────────────────────────────────────────
// GET /api/v1/public/verify/:memberNumber → { valid, member?, reason? }
api.get('/public/verify/:memberNumber', verifyMember);
// GET /api/v1/public/tiers → { tiers[] }
api.get('/public/tiers', publicTiers);

// ─── Fallbacks ──────────────────────────────────────────
api.use(apiNotFound);
api.use(apiErrorHandler);

export default api;