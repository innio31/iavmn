// src/middleware/apiErrorHandler.js
// JSON-only error responses for /api/v1/*.
// Mounted on the apiRouter so it only affects API routes.

/**
 * 404 fallback — reached when no API route matched.
 * Usage: apiRouter.use(apiNotFound);
 */
export const apiNotFound = (req, res) => {
  res.status(404).json({
    error: 'Not found.',
    code: 'NOT_FOUND',
  });
};

/**
 * Error handler — catches anything thrown by API controllers.
 * Usage: apiRouter.use(apiErrorHandler);  (must be after all routes)
 */
export const apiErrorHandler = (err, req, res, next) => {
  // If a previous handler already started writing, bail out.
  if (res.headersSent) return next(err);

  const status = Number(err.status) || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL' : 'ERROR');

  // Log server errors only — 4xx are expected and noisy.
  if (status >= 500) {
    console.error('[api]', req.method, req.originalUrl, '→', err.message);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  }

  res.status(status).json({
    error:
      status >= 500 && process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : err.message || 'Request failed.',
    code,
  });
};