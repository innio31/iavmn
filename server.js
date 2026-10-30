// server.js
// App setup only: middleware, sessions, flash, static files, EJS, router mount, error handlers.

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pool from './src/db.js';
import flashMiddleware from './src/middleware/flash.js';
import loadSettings from './src/middleware/loadSettings.js';
import loadMenuPages from './src/middleware/loadMenuPages.js';
import notificationCounts from './src/middleware/notificationCounts.js';
import { loadMember } from './src/middleware/memberAuth.js';
import router from './src/routes.js';
import apiRouter from './src/routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ─── Trust proxy (HostAfrica runs nginx in front of Node) ────
app.set('trust proxy', 1);

// ─── View engine ────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// ─── Security & logging ─────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
if (!isProd) app.use(morgan('dev'));

// ─── Body parsers ───────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.startsWith('/webhooks/')) {
        req.rawBody = buf.toString('utf8');
      }
    },
  })
);

// ─── API (mobile) ───────────────────────────────────────
// Mounted BEFORE sessions/flash so API requests don't touch the session store.
// CORS is scoped to /api/v1 only; the web app never needs it.
const allowedOrigins = (process.env.API_CORS_ORIGINS || '*')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  '/api/v1',
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use('/api/v1', apiRouter);

// ─── Static files ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Sessions (MySQL-backed) ────────────────────────────
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    schema: {
      tableName: 'user_sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  pool
);

app.use(
  session({
    store: sessionStore,
    name: 'iavmn.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10),
    },
  })
);

// ─── Flash messages ─────────────────────────────────────
app.use(flashMiddleware);

// ─── Common locals for every view ───────────────────────
app.use((req, res, next) => {
  res.locals.appName = process.env.APP_NAME || 'IAVMN';
  res.locals.appUrl = process.env.APP_URL || '';
  res.locals.currentUser = req.session?.user || null;
  res.locals.currentPath = req.path;
  next();
});

// ─── Load site settings ─────────────────────────────────
app.use(loadSettings);

// ─── Load menu pages ────────────────────────────────────
app.use(loadMenuPages);

// ─── Load current member (if any) ───────────────────────
app.use(loadMember);

// ─── Notification counts (admin sidebar badges) ─────────
app.use(notificationCounts);

// ─── Routes ─────────────────────────────────────────────
app.use('/', router);

// ─── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Page Not Found' });
});

// ─── API error passthrough (before the web 500 handler) ─
// Ensures /api/* requests always get JSON, even for errors thrown
// before the request reaches the API router (e.g. bad JSON body).
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const status = err.status || 500;
    return res.status(status).json({
      error: status >= 500 ? 'Something went wrong.' : err.message || 'Request failed.',
      code: status === 400 && err.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'ERROR',
    });
  }
  return next(err);
});

// ─── 500 ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).render('errors/500', {
    title: 'Server Error',
    message: isProd ? 'Something went wrong.' : err.message,
  });
});

// ─── Start ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] IAVMN running on http://localhost:${PORT}`);
});