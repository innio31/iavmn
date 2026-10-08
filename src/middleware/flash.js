// src/middleware/flash.js
// Session-based flash messages. Post-Redirect-Get friendly.
//
// Usage in a controller:
//   req.flash('success', 'Application submitted.');
//   req.flash('error', 'Invalid credentials.');
//   res.redirect('/login');
//
// Usage in a view (via res.locals.flash):
//   <% if (flash.success) { %> <div class="alert alert-success"><%= flash.success %></div> <% } %>
//
// Multiple messages of the same type are supported (flash.success becomes an array if >1).

const flashMiddleware = (req, res, next) => {
  // Pull messages left by the previous request
  const stored = req.session?.flash || {};
  delete req.session.flash;

  // Helper to set a new flash message
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    const existing = req.session.flash[type];
    if (existing === undefined) {
      req.session.flash[type] = message;
    } else if (Array.isArray(existing)) {
      existing.push(message);
    } else {
      req.session.flash[type] = [existing, message];
    }
  };

  // Normalize to arrays for easy iteration in views
  const normalized = {};
  for (const [type, value] of Object.entries(stored)) {
    normalized[type] = Array.isArray(value) ? value : [value];
  }

  res.locals.flash = normalized;
  next();
};

export default flashMiddleware;