// src/middleware/auth.js
// Route guards: requireLogin, requireRole, requireGuest, requireSetupDone.
// These check req.session.user, which is set by the auth controller on successful login.

/**
 * Require an authenticated session. Redirects to /login if not logged in.
 * Preserves the originally requested URL so we can bounce the user back after login.
 */
export const requireLogin = (req, res, next) => {
  if (req.session?.user) return next();
  const redirectTo = encodeURIComponent(req.originalUrl || '/admin');
  req.flash('error', 'Please log in to continue.');
  return res.redirect(`/login?next=${redirectTo}`);
};

/**
 * Require a specific role (or one of several). Must be used AFTER requireLogin.
 * Usage:
 *   router.get('/admin/users', requireLogin, requireRole('super_admin'), controller)
 *   router.get('/admin/editor', requireLogin, requireRole('super_admin','admin'), controller)
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      req.flash('error', 'Please log in to continue.');
      return res.redirect('/login');
    }
    if (!allowedRoles.includes(user.role_name)) {
      req.flash('error', 'You do not have permission to access that page.');
      return res.status(403).render('errors/403', { title: 'Forbidden' });
    }
    return next();
  };
};

/**
 * Require that the user is NOT logged in. Used on /login and /setup.
 * If logged in, redirects to /admin.
 */
export const requireGuest = (req, res, next) => {
  if (req.session?.user) return res.redirect('/admin');
  return next();
};

/**
 * Require that no users exist yet — used by /setup.
 * Once any user exists, /setup is closed forever.
 */
export const requireNoUsers = async (req, res, next) => {
  try {
    const { countUsers } = await import('../models/userModel.js');
    const n = await countUsers();
    if (n > 0) {
      return res.status(404).render('errors/404', { title: 'Page Not Found' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
};