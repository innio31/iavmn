// src/routes.js
// Root router. All routes live here. Controllers handle logic — never db.js directly.

import { Router } from 'express';

import {
  showSetup,
  postSetup,
  setupValidators,
  showLogin,
  postLogin,
  loginValidators,
  postLogout,
} from './controllers/authController.js';

import {
  showForgotPassword,
  postForgotPassword,
  showResetPassword,
  postResetPassword,
  forgotValidators,
  resetValidators,
} from './controllers/adminPasswordResetController.js';

import {
  showSettings,
  postSettings,
} from './controllers/settingsController.js';

import {
  listHero,
  showNewHero,
  postNewHero,
  showEditHero,
  postEditHero,
  postToggleHero,
  postDeleteHero,
  heroValidators,
} from './controllers/heroController.js';

import {
  listCouncil,
  showNewMember,
  postNewMember,
  showEditMember,
  postEditMember as postEditCouncilMember,
  postToggleMember,
  postDeleteMember as postDeleteCouncilMember,
  publicListCouncil,
  publicMemberProfile,
  memberValidators,
} from './controllers/councilController.js';

import {
  listTiersAdmin,
  showNewTier,
  postNewTier,
  showEditTier,
  postEditTier,
  postToggleTier,
  postDeleteTier,
  publicListTiers,
  publicTierDetail,
  tierValidators,
} from './controllers/tierController.js';

import {
  listFaqsAdmin,
  showNewFaq,
  postNewFaq,
  showEditFaq,
  postEditFaq,
  postToggleFaq,
  postDeleteFaq,
  publicFaqPage,
  faqValidators,
} from './controllers/faqController.js';

import {
  listTestimonialsAdmin,
  showNewTestimonial,
  postNewTestimonial,
  showEditTestimonial,
  postEditTestimonial,
  postToggleTestimonial,
  postDeleteTestimonial,
  testimonialValidators,
} from './controllers/testimonialController.js';

import {
  listPagesAdmin,
  showNewPage,
  postNewPage,
  showEditPage,
  postEditPage,
  postTogglePage,
  postDeletePage,
  publicPage,
  pageValidators,
} from './controllers/pageController.js';

import {
  listSubscribersAdmin,
  postToggleSubscriber,
  postDeleteSubscriber,
  postSubscribe,
  publicUnsubscribe,
  exportSubscribersCsv,
  subscribeValidators,
} from './controllers/subscriberController.js';

import {
  listNewslettersAdmin,
  showComposeNewsletter,
  postSendNewsletter,
  showNewsletterDetail,
  postSendTest,
  postDeleteNewsletter,
  postResumeNewsletter,
  composeValidators,
  testSendValidators,
} from './controllers/newsletterController.js';

import {
  showContactPage,
  postContact,
  listMessagesAdmin,
  showMessageAdmin,
  postToggleMessage,
  postMarkAllRead,
  postDeleteMessage,
  contactValidators,
} from './controllers/contactController.js';

import {
  listPostsAdmin,
  showNewPost,
  postNewPost,
  showEditPost,
  postEditPost,
  postTogglePost,
  postDeletePost,
  publicListPosts,
  publicPostDetail,
  postValidators,
} from './controllers/postController.js';

import {
  showApplyForm,
  postApplyForm,
  showApplicationSuccess,
  listApplicationsAdmin,
  showApplicationAdmin,
  postUpdateApplicationStatus,
  postDeleteApplication,
  applicationValidators,
} from './controllers/applicationController.js';

import {
  showPayPage,
  handlePaymentCallback,
  showMockCheckout,
  handlePaystackWebhook,
  showPaystackTest,
} from './controllers/paymentController.js';

import {
  listUsersAdmin,
  showNewUser,
  postNewUser,
  showEditUser,
  postEditUser,
  postChangePassword,
  postToggleUser,
  postDeleteUser,
  newUserValidators,
  editUserValidators,
  passwordChangeValidators,
} from './controllers/userController.js';

import {
  showMemberLogin,
  postMemberLogin,
  postMemberLogout,
  showSetPassword,
  postSetPassword,
  showForgotPassword as showMemberForgotPassword,
  postForgotPassword as postMemberForgotPassword,
  showResetPassword as showMemberResetPassword,
  postResetPassword as postMemberResetPassword,
  loginValidators as memberLoginValidators,
  setPasswordValidators,
  forgotPasswordValidators as memberForgotValidators,
} from './controllers/memberAuthController.js';

import {
  showDashboard as showMemberDashboard,
  showProfile as showMemberProfile,
  postProfile as postMemberProfile,
  showPayments as showMemberPayments,
  showCertificate as showMemberCertificate,
  profileValidators as memberProfileValidators,
} from './controllers/memberDashboardController.js';

import {
  listMembersAdmin,
  showMemberAdmin,
  postEditMember as postEditMemberAdmin,
  postToggleMemberStatus,
  postSetMemberPassword,
  postSendResetLink,
  postResendWelcome,
  postDeleteMember as postDeleteMemberAdmin,
  memberEditValidators,
  memberPasswordValidators,
} from './controllers/adminMemberController.js';

import {
  downloadCertificatePdf,
  serveQrCode,
} from './controllers/certificateController.js';

import { showVerifyPage } from './controllers/verifyController.js';
import { pollEvents } from './controllers/eventsController.js';
import { showSearchPage, suggestSearch } from './controllers/searchController.js';

import { showHome } from './controllers/homeController.js';
import { showDashboard } from './controllers/dashboardController.js';
import { renderSitemap } from './controllers/sitemapController.js';

import {
  requireGuest,
  requireNoUsers,
  requireLogin,
  requireRole,
} from './middleware/auth.js';

import {
  requireMemberLogin,
  requireMemberGuest,
} from './middleware/memberAuth.js';

import {
  uploadHero,
  uploadCouncil,
  uploadTestimonial,
  uploadPost,
  uploadApplication,
  handleUploadErrors,
} from './middleware/upload.js';

const router = Router();

// ─── Health check ───────────────────────────────────────
router.get('/healthz', (req, res) => {
  res.json({ ok: true, app: 'IAVMN', time: new Date().toISOString() });
});

// ─── Public: home ───────────────────────────────────────
router.get('/', showHome);

// ─── Public: search ─────────────────────────────────────
router.get('/search/suggest', suggestSearch);
router.get('/search', showSearchPage);

// ─── Public: newsletter ─────────────────────────────────
router.post('/subscribe', subscribeValidators, postSubscribe);
router.get('/unsubscribe/:token', publicUnsubscribe);

// ─── Public: contact ────────────────────────────────────
router.get('/contact', showContactPage);
router.post('/contact', contactValidators, postContact);

// ─── Public: news ───────────────────────────────────────
router.get('/news', publicListPosts);
router.get('/news/:slug', publicPostDetail);

// ─── Public: council members ────────────────────────────
router.get('/council-members', publicListCouncil);
router.get('/council-members/:slug', publicMemberProfile);

// ─── Public: membership tiers ───────────────────────────
router.get('/membership', publicListTiers);
router.get('/membership/:slug', publicTierDetail);

// ─── Public: membership applications & payment ──────────
router.get('/membership/apply/:reference/success', showApplicationSuccess);
router.get('/membership/apply/:reference/pay', showPayPage);
router.get('/membership/apply/:reference/mock-checkout', showMockCheckout);
router.get('/membership/apply/:reference/callback', handlePaymentCallback);
router.post('/membership/apply/:reference/callback', handlePaymentCallback);

router.get('/membership/:slug/apply', showApplyForm);
router.post(
  '/membership/:slug/apply',
  uploadApplication,
  handleUploadErrors('/membership'),
  applicationValidators,
  postApplyForm
);

// ─── Public: Paystack webhook ───────────────────────────
router.post('/webhooks/paystack', handlePaystackWebhook);

// ─── Public: FAQ ────────────────────────────────────────
router.get('/faq', publicFaqPage);

// ─── Public: member verification ────────────────────────
router.get('/verify', showVerifyPage);
router.get('/verify/*', (req, res, next) => {
  const wildcard = req.params[0] || '';
  if (!wildcard) return next();
  req.query.memberNumber = wildcard;
  return showVerifyPage(req, res, next);
});

// ─── Public: sitemap ────────────────────────────────────
router.get('/sitemap.xml', renderSitemap);

// ─── Member portal: auth ────────────────────────────────
router.get('/member/login', requireMemberGuest, showMemberLogin);
router.post('/member/login', requireMemberGuest, memberLoginValidators, postMemberLogin);
router.post('/member/logout', postMemberLogout);

router.get('/member/forgot-password', requireMemberGuest, showMemberForgotPassword);
router.post('/member/forgot-password', requireMemberGuest, memberForgotValidators, postMemberForgotPassword);

router.get('/member/set-password/:token', showSetPassword);
router.post('/member/set-password/:token', setPasswordValidators, postSetPassword);

router.get('/member/reset-password/:token', showMemberResetPassword);
router.post('/member/reset-password/:token', setPasswordValidators, postMemberResetPassword);

// ─── Member portal: dashboard (protected) ───────────────
router.get('/member', requireMemberLogin, showMemberDashboard);
router.get('/member/profile', requireMemberLogin, showMemberProfile);
router.post('/member/profile', requireMemberLogin, memberProfileValidators, postMemberProfile);
router.get('/member/payments', requireMemberLogin, showMemberPayments);
router.get('/member/certificate', requireMemberLogin, showMemberCertificate);
router.get('/member/certificate/qr.png', requireMemberLogin, serveQrCode);
router.get('/member/certificate/download.pdf', requireMemberLogin, downloadCertificatePdf);

// ─── Auth: admin one-time setup ─────────────────────────
router.get('/setup', requireNoUsers, requireGuest, showSetup);
router.post('/setup', requireNoUsers, requireGuest, setupValidators, postSetup);

// ─── Auth: admin login / logout ─────────────────────────
router.get('/login', requireGuest, showLogin);
router.post('/login', requireGuest, loginValidators, postLogin);
router.post('/logout', postLogout);

// ─── Auth: admin password reset ─────────────────────────
router.get('/forgot-password', requireGuest, showForgotPassword);
router.post('/forgot-password', requireGuest, forgotValidators, postForgotPassword);
router.get('/reset-password/:token', showResetPassword);
router.post('/reset-password/:token', resetValidators, postResetPassword);

// ─── Admin: real-time events (polling) ──────────────────
router.get('/admin/events/poll', requireLogin, pollEvents);

// ─── Admin: dashboard ───────────────────────────────────
router.get('/admin', requireLogin, showDashboard);

// ─── Admin: settings ────────────────────────────────────
router.get('/admin/settings', requireLogin, showSettings);
router.post('/admin/settings', requireLogin, postSettings);

// ─── Admin: hero slides ─────────────────────────────────
router.get('/admin/hero', requireLogin, listHero);
router.get('/admin/hero/new', requireLogin, showNewHero);
router.post(
  '/admin/hero',
  requireLogin,
  uploadHero,
  handleUploadErrors('/admin/hero/new'),
  heroValidators,
  postNewHero
);
router.get('/admin/hero/:id/edit', requireLogin, showEditHero);
router.post(
  '/admin/hero/:id',
  requireLogin,
  uploadHero,
  handleUploadErrors('/admin/hero'),
  heroValidators,
  postEditHero
);
router.post('/admin/hero/:id/toggle', requireLogin, postToggleHero);
router.post('/admin/hero/:id/delete', requireLogin, postDeleteHero);

// ─── Admin: council members ─────────────────────────────
router.get('/admin/council', requireLogin, listCouncil);
router.get('/admin/council/new', requireLogin, showNewMember);
router.post(
  '/admin/council',
  requireLogin,
  uploadCouncil,
  handleUploadErrors('/admin/council/new'),
  memberValidators,
  postNewMember
);
router.get('/admin/council/:id/edit', requireLogin, showEditMember);
router.post(
  '/admin/council/:id',
  requireLogin,
  uploadCouncil,
  handleUploadErrors('/admin/council'),
  memberValidators,
  postEditCouncilMember
);
router.post('/admin/council/:id/toggle', requireLogin, postToggleMember);
router.post('/admin/council/:id/delete', requireLogin, postDeleteCouncilMember);

// ─── Admin: membership tiers ────────────────────────────
router.get('/admin/tiers', requireLogin, listTiersAdmin);
router.get('/admin/tiers/new', requireLogin, showNewTier);
router.post('/admin/tiers', requireLogin, tierValidators, postNewTier);
router.get('/admin/tiers/:id/edit', requireLogin, showEditTier);
router.post('/admin/tiers/:id', requireLogin, tierValidators, postEditTier);
router.post('/admin/tiers/:id/toggle', requireLogin, postToggleTier);
router.post('/admin/tiers/:id/delete', requireLogin, postDeleteTier);

// ─── Admin: FAQs ────────────────────────────────────────
router.get('/admin/faqs', requireLogin, listFaqsAdmin);
router.get('/admin/faqs/new', requireLogin, showNewFaq);
router.post('/admin/faqs', requireLogin, faqValidators, postNewFaq);
router.get('/admin/faqs/:id/edit', requireLogin, showEditFaq);
router.post('/admin/faqs/:id', requireLogin, faqValidators, postEditFaq);
router.post('/admin/faqs/:id/toggle', requireLogin, postToggleFaq);
router.post('/admin/faqs/:id/delete', requireLogin, postDeleteFaq);

// ─── Admin: testimonials ────────────────────────────────
router.get('/admin/testimonials', requireLogin, listTestimonialsAdmin);
router.get('/admin/testimonials/new', requireLogin, showNewTestimonial);
router.post(
  '/admin/testimonials',
  requireLogin,
  uploadTestimonial,
  handleUploadErrors('/admin/testimonials/new'),
  testimonialValidators,
  postNewTestimonial
);
router.get('/admin/testimonials/:id/edit', requireLogin, showEditTestimonial);
router.post(
  '/admin/testimonials/:id',
  requireLogin,
  uploadTestimonial,
  handleUploadErrors('/admin/testimonials'),
  testimonialValidators,
  postEditTestimonial
);
router.post('/admin/testimonials/:id/toggle', requireLogin, postToggleTestimonial);
router.post('/admin/testimonials/:id/delete', requireLogin, postDeleteTestimonial);

// ─── Admin: pages ───────────────────────────────────────
router.get('/admin/pages', requireLogin, listPagesAdmin);
router.get('/admin/pages/new', requireLogin, showNewPage);
router.post('/admin/pages', requireLogin, pageValidators, postNewPage);
router.get('/admin/pages/:id/edit', requireLogin, showEditPage);
router.post('/admin/pages/:id', requireLogin, pageValidators, postEditPage);
router.post('/admin/pages/:id/toggle', requireLogin, postTogglePage);
router.post('/admin/pages/:id/delete', requireLogin, postDeletePage);

// ─── Admin: subscribers ─────────────────────────────────
router.get('/admin/subscribers', requireLogin, listSubscribersAdmin);
router.get('/admin/subscribers/export.csv', requireLogin, exportSubscribersCsv);
router.post('/admin/subscribers/:id/toggle', requireLogin, postToggleSubscriber);
router.post('/admin/subscribers/:id/delete', requireLogin, postDeleteSubscriber);

// ─── Admin: newsletter campaigns ────────────────────────
router.get('/admin/newsletter', requireLogin, listNewslettersAdmin);
router.get('/admin/newsletter/new', requireLogin, showComposeNewsletter);
router.post('/admin/newsletter', requireLogin, composeValidators, postSendNewsletter);
router.post('/admin/newsletter/test', requireLogin, testSendValidators, postSendTest);
router.get('/admin/newsletter/:id', requireLogin, showNewsletterDetail);
router.post('/admin/newsletter/:id/resume', requireLogin, postResumeNewsletter);
router.post('/admin/newsletter/:id/delete', requireLogin, postDeleteNewsletter);

// ─── Admin: contact messages ────────────────────────────
router.get('/admin/messages', requireLogin, listMessagesAdmin);
router.post('/admin/messages/mark-all-read', requireLogin, postMarkAllRead);
router.get('/admin/messages/:id', requireLogin, showMessageAdmin);
router.post('/admin/messages/:id/toggle', requireLogin, postToggleMessage);
router.post('/admin/messages/:id/delete', requireLogin, postDeleteMessage);

// ─── Admin: posts ───────────────────────────────────────
router.get('/admin/posts', requireLogin, listPostsAdmin);
router.get('/admin/posts/new', requireLogin, showNewPost);
router.post(
  '/admin/posts',
  requireLogin,
  uploadPost,
  handleUploadErrors('/admin/posts/new'),
  postValidators,
  postNewPost
);
router.get('/admin/posts/:id/edit', requireLogin, showEditPost);
router.post(
  '/admin/posts/:id',
  requireLogin,
  uploadPost,
  handleUploadErrors('/admin/posts'),
  postValidators,
  postEditPost
);
router.post('/admin/posts/:id/toggle', requireLogin, postTogglePost);
router.post('/admin/posts/:id/delete', requireLogin, postDeletePost);

// ─── Admin: applications ────────────────────────────────
router.get('/admin/applications', requireLogin, listApplicationsAdmin);
router.get('/admin/applications/:id', requireLogin, showApplicationAdmin);
router.post('/admin/applications/:id/status', requireLogin, postUpdateApplicationStatus);
router.post('/admin/applications/:id/resend-welcome', requireLogin, postResendWelcome);
router.post('/admin/applications/:id/delete', requireLogin, postDeleteApplication);

// ─── Admin: members ─────────────────────────────────────
router.get('/admin/members', requireLogin, listMembersAdmin);
router.get('/admin/members/:id', requireLogin, showMemberAdmin);
router.post(
  '/admin/members/:id',
  requireLogin,
  memberEditValidators,
  postEditMemberAdmin
);
router.post('/admin/members/:id/status', requireLogin, postToggleMemberStatus);
router.post(
  '/admin/members/:id/password',
  requireLogin,
  memberPasswordValidators,
  postSetMemberPassword
);
router.post('/admin/members/:id/send-reset', requireLogin, postSendResetLink);
router.post('/admin/members/:id/delete', requireLogin, postDeleteMemberAdmin);

// ─── Admin: Paystack test page ──────────────────────────
router.get('/admin/paystack-test', requireLogin, showPaystackTest);

// ─── Admin: users (super_admin only) ────────────────────
router.get('/admin/users', requireLogin, requireRole('super_admin'), listUsersAdmin);
router.get('/admin/users/new', requireLogin, requireRole('super_admin'), showNewUser);
router.post(
  '/admin/users',
  requireLogin,
  requireRole('super_admin'),
  newUserValidators,
  postNewUser
);
router.get('/admin/users/:id/edit', requireLogin, requireRole('super_admin'), showEditUser);
router.post(
  '/admin/users/:id',
  requireLogin,
  requireRole('super_admin'),
  editUserValidators,
  postEditUser
);
router.post(
  '/admin/users/:id/password',
  requireLogin,
  requireRole('super_admin'),
  passwordChangeValidators,
  postChangePassword
);
router.post('/admin/users/:id/toggle', requireLogin, requireRole('super_admin'), postToggleUser);
router.post('/admin/users/:id/delete', requireLogin, requireRole('super_admin'), postDeleteUser);

// ─── Public: standalone pages (MUST BE LAST — catch-all) ─
router.get('/:slug', publicPage);

export default router;