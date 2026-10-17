# IAVMN — Institute of Assets & Value Management Nigeria

A dynamic, admin-managed website for the Institute of Assets & Value Management Nigeria (IAVMN).

Built with **Node.js + Express + EJS + MySQL**. Content is fully manageable from an admin dashboard — no code changes needed to update the site.

- **Live site:** https://iavmn.org.ng
- **Admin:** https://iavmn.org.ng/admin
- **Member portal:** https://iavmn.org.ng/member/login

---

## What This App Does

### Public site

- **Home page** — hero carousel, membership cards, testimonials, latest news
- **Council Members** — listing with photos and individual profile pages
- **Membership Tiers** — Student, Associate, Corporate, Fellow (fully configurable)
- **Membership Applications** — online form with CV + passport photo upload
- **Paystack Payments** — secure online payments
- **Member Portal** — login, profile, payments history, certificate download
- **Certificate PDF** — auto-generated with QR code
- **Public Verification** — `/verify/:memberNumber` — anyone can check
- **News & Updates** — blog with pagination and share buttons
- **FAQ** — accordion page
- **Contact** — form with email notifications
- **Newsletter** — subscribe, welcome email, one-click unsubscribe
- **Site-wide Search** — live suggestions across all content
- **PWA installable** — can be added to a phone's home screen
- **SEO-complete** — meta, OG, Twitter Cards, JSON-LD, sitemap, robots

### Admin dashboard

Everything manageable at `/admin`:

- Dashboard with live stats and activity feed
- Settings (site name, contact, social, email, payment, analytics, SEO, footer, system)
- Hero Slides, Membership Tiers, Council Members, Pages, FAQs, Testimonials, Posts
- Applications inbox with filters and review workflow
- Members management with tier/status/expiry/password controls
- Newsletter compose and send (with batching)
- Subscribers list with CSV export
- Contact Messages inbox
- Admin Users with role-based access

### Roles

| Role | Permissions |
|---|---|
| `super_admin` | Everything + manage other admin users |
| `admin` | Everything except user management |
| `editor` | Content only (pages, posts, hero, tiers, council, FAQs, testimonials) |
| `membership_officer` | Review applications + view members |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ (production: 20.x) |
| Framework | Express 4 |
| Templating | EJS with express-ejs-layouts |
| Database | MySQL 8 / MariaDB 10.4+ |
| DB Driver | mysql2 (Promise-based) |
| Sessions | express-session + express-mysql-session |
| Password hashing | bcrypt (12 rounds) |
| Validation | express-validator |
| File uploads | multer |
| Email | Nodemailer (SMTP) |
| Payments | Paystack |
| PDF generation | pdfkit |
| QR codes | qrcode |
| Security | Helmet, parameterized queries |

---

## Project Structure

```
iavmn/
├── server.js                 # App entry point (setup only — no routes)
├── package.json
├── .env                      # Secrets (never commit)
├── README.md                 # This file
├── DEPLOYMENT.md             # Deployment guide
├── ADMIN-MANUAL.md           # Manual for the institute
├── HANDOVER.md               # Launch handover summary
├── database/
│   ├── schema.sql
│   ├── seed-settings.sql
│   └── migrations/
│       ├── 001-add-menu-fields-to-pages.sql
│       ├── 002-create-members-table.sql
│       ├── 003-add-reset-token-to-users.sql
│       ├── 004-create-newsletter-sends-table.sql
│       └── 005-add-analytics-and-seo-settings.sql
├── public/
│   ├── css/
│   │   ├── theme.css                # Public styles
│   │   ├── admin.css                # Admin styles
│   │   ├── auth.css                 # Login/setup styles
│   │   ├── member.css               # Member portal styles
│   │   └── responsive-helpers.css   # hide-mobile / show-mobile utilities
│   ├── js/
│   │   ├── admin-events.js          # Admin polling notifications
│   │   ├── search-overlay.js        # Header search overlay
│   │   └── pwa-install.js           # PWA install button handler
│   ├── sw.js                        # Service worker (PWA)
│   ├── site.webmanifest             # PWA manifest
│   ├── robots.txt
│   ├── favicon.ico
│   └── uploads/
│       ├── branding/                # Logo, favicon, icons
│       ├── hero/
│       ├── council/
│       ├── testimonials/
│       ├── posts/
│       └── applications/            # Applicant CVs and photos
└── src/
    ├── db.js                       # MySQL pool
    ├── routes.js                   # All routes
    ├── controllers/                # Request handlers
    ├── models/                     # Database access
    ├── middleware/                 # Auth, flash, uploads, settings
    ├── services/                   # Mailer, Paystack, eventBus
    ├── utils/                      # File cleanup
    └── views/
        ├── layouts/                # main, admin, auth, member
        ├── partials/               # header, footer
        ├── errors/                 # 403, 404, 500
        ├── emails/                 # Email templates
        ├── admin/                  # Admin views
        ├── members/                # Member portal views
        └── *.ejs                   # Public pages
```

---

## Running Locally

### Prerequisites

- **Node.js 18+** — https://nodejs.org
- **MySQL 8+** (or MariaDB 10.4+) — XAMPP recommended on Windows
- **Git**

### Setup

1. **Clone the repo**
   ```bash
   git clone <your-repo-url> iavmn
   cd iavmn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create the database**
   - Open phpMyAdmin (XAMPP → MySQL → Admin)
   - Create a database named `impactdi_iavmn`
   - Import `database/schema.sql`
   - Import `database/seed-settings.sql`
   - Import all 5 files in `database/migrations/` in order

4. **Create `.env`**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   - `DB_USER`, `DB_PASSWORD` — your local MySQL credentials
   - `DB_NAME` — `impactdi_iavmn`
   - `SESSION_SECRET` — generate with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - Leave email and Paystack as placeholders — the app runs in dev mode without them

5. **Start the app**
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

6. **First-time admin setup**
   - Visit http://localhost:3000/setup
   - Create your super admin account
   - You're redirected to `/admin`

### Dev scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with file watching (auto-restart on `.js` changes) |
| `npm start` | Start once (production) |

**Note:** `.ejs` files reload on every request. `.js` files need a restart (`npm run dev` handles this).

---

## Environment Variables

Full reference — see `.env.example`:

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default 3000) |
| `APP_NAME` | Short name for emails and headers |
| `APP_URL` | Full URL (used in emails, sitemap, Paystack callbacks) |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (3306 default) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `SESSION_SECRET` | Long random string (48+ bytes) |
| `SESSION_MAX_AGE_MS` | Session lifetime in ms (86400000 = 24h) |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP port (465 SSL or 587 STARTTLS) |
| `MAIL_SECURE` | `true` for 465, `false` for 587 |
| `MAIL_USER` | Full email address |
| `MAIL_PASS` | Email password |
| `MAIL_FROM_NAME` | Display name for sent emails |
| `MAIL_FROM_EMAIL` | From address |
| `PAYSTACK_PUBLIC_KEY` | `pk_test_*` or `pk_live_*` |
| `PAYSTACK_SECRET_KEY` | `sk_test_*` or `sk_live_*` |
| `UPLOAD_DIR` | Upload folder (default `public/uploads`) |
| `MAX_UPLOAD_MB` | Max upload size (default 5) |

### Dev-mode fallbacks

- **No SMTP configured** → emails print to the console
- **No Paystack keys** → a mock checkout page simulates successful payments
- **No favicon** → browser shows default

This means the app **works out of the box** with just a database.

---

## Production Notes (Important)

Several production gotchas were hit during deployment and are now fixed in the code. Documented here so future developers understand why certain lines exist:

### 1. `app.set('trust proxy', 1)` in `server.js`

HostAfrica runs LiteSpeed/nginx in front of the Node app over plain HTTP. Without this setting, Express thinks requests are HTTP even when the visitor is on HTTPS, so **Secure session cookies are never set** and login fails silently.

### 2. `proxy: true` in the session config

Belt-and-braces with `trust proxy` — tells express-session to trust the `X-Forwarded-Proto` header.

### 3. Polling instead of SSE for admin notifications

The original implementation used Server-Sent Events. **HostAfrica's LiteSpeed proxy buffers SSE responses** — the browser received the initial headers but no event data ever flowed through.

We switched to **polling every 15 seconds** against `/admin/events/poll`. It works reliably on any shared host. No long-lived connections needed.

### 4. `appUrl` injected into email templates from `mailer.js`

EJS templates run in a sandbox and **do not have access to `process.env`**. The original templates read `process.env.APP_URL` and fell back to `http://localhost:3000`, so all email links pointed to localhost.

Fixed by injecting `appUrl` into the render data in `src/services/mailer.js`. Templates now use `appUrl || (settings && settings.app_url) || 'https://iavmn.org.ng'`.

### 5. `public/favicon.ico` at the root

Browsers request `/favicon.ico` at the domain root regardless of any `<link rel="icon">` tag. Without a file there, you get a 404 on every page. We placed a copy at `public/favicon.ico`.

### 6. `public/css/responsive-helpers.css`

Contains the `.hide-mobile` and `.show-mobile` rules used throughout admin tables and cards. Loaded in every layout — **do not remove this link**.

### 7. Service worker caching rules

`public/sw.js` deliberately does **not** cache:
- `/admin/*`
- `/member/*`
- `/login`, `/setup`, `/forgot-password`
- `/contact` (POST)
- `/search`
- `/webhooks/*`
- `/membership/apply/*`

Public HTML uses network-first with cache fallback. Static assets use cache-first with revalidation.

### 8. Session cookie name is `iavmn.sid`

If you ever need to clear sessions for all users, delete rows from the `user_sessions` table in MySQL.

---

## Database Migrations

When you add a new column or table, create a new file in `database/migrations/` numbered sequentially:

```
006-your-change.sql
007-another-change.sql
```

Each migration should be **idempotent** (safe to re-run) — check for column existence before `ALTER TABLE`.

**Note:** There is no migration runner. Migrations are applied manually via phpMyAdmin or the SQL tab. This is intentional — it keeps deployment simple and auditable.

---

## Paystack Integration

- **Test mode**: `pk_test_*` and `sk_test_*` in `.env`
- **Live mode**: `pk_live_*` and `sk_live_*` — swap on the server and restart
- **Webhook URL** in Paystack dashboard: `https://iavmn.org.ng/webhooks/paystack`
- **Mock checkout** appears automatically when keys are placeholders

Flow:
1. Applicant submits form → application saved with unique reference
2. Redirect to `/membership/apply/:ref/pay`
3. `initializeTransaction` → user pays on Paystack
4. Callback → `verifyTransaction` → update DB → emails sent
5. Webhook provides a secondary confirmation (belt-and-braces)

---

## Email System

- Uses **Nodemailer** with explicit SMTP
- All email sending is wrapped in `try/catch` — user-facing actions **never** fail because email failed
- Templates in `src/views/emails/` are rendered by `renderEmail()` in `mailer.js`
- `appUrl` is injected into every template — templates should use `appUrl` (not `process.env`)

**Templates:**
- `contact-notification.ejs` — to admin
- `contact-acknowledgement.ejs` — to sender
- `subscriber-welcome.ejs` — newsletter welcome
- `application-received.ejs` — to applicant
- `application-admin-notification.ejs` — to admin
- `application-decision.ejs` — approved/rejected
- `payment-confirmed.ejs` — receipt
- `payment-admin-notification.ejs` — to admin
- `member-welcome.ejs` — approval + set password
- `member-password-reset.ejs` — password reset
- `admin-password-reset.ejs` — admin password reset
- `newsletter.ejs` — campaign wrapper

---

## Security Notes

- **Passwords** — bcrypt, 12 rounds
- **SQL** — parameterized queries only (`?` placeholders)
- **Sessions** — server-side, MySQL-backed, HTTP-only, regenerated on login
- **Role checks** — server-side middleware; hidden links are never trusted
- **Uploads** — MIME-type validated, filenames sanitized, size-limited
- **Path traversal** — file cleanup refuses paths outside `public/uploads/`
- **CSRF-adjacent** — admin routes require login + role; POST forms + session

### Known workarounds

- **HostAfrica's mail SSL certificate** — `mailer.js` uses `rejectUnauthorized: false` for SMTP. Remove when HostAfrica renews the certificate.

---

## Backups

```bash
# Database
mysqldump -u DB_USER -p DB_NAME > backup-$(date +%Y%m%d).sql

# Uploads
tar czf uploads-$(date +%Y%m%d).tar.gz public/uploads/
```

See `DEPLOYMENT.md` for automated cron-based backups.

---

## Troubleshooting

### Server won't start
- Run `node server.js` directly and read the error
- Check `.env` values
- Verify MySQL is running and the database exists

### Login fails silently
- Check `app.set('trust proxy', 1)` is present in `server.js`
- Check `Secure` cookies are being set (DevTools → Network → POST /login → Response Headers → Set-Cookie)
- Clear cookies for the site and try again

### Emails not sending
- Test with:
  ```bash
  node -e "import('./src/services/mailer.js').then(m => m.sendMail({ to: 'you@example.com', subject: 'Test', html: '<p>Hi</p>' }))"
  ```
- If it prints to console → SMTP not configured (check `.env`)

### Emails have wrong URLs
- The template should use `appUrl` (injected by `mailer.js`) not `process.env.APP_URL`
- Verify `.env` has `APP_URL=https://iavmn.org.ng`

### Real-time pill says "Connecting" forever
- The polling endpoint is `/admin/events/poll`
- Check Network tab for a request to that URL
- Should return 200 with JSON

### Uploads fail
- Check `public/uploads/` exists and is writable
- Check file type and size (max 5 MB)
- Check disk space: `df -h ~`

### Paystack not working
- Visit `/admin/paystack-test` to see if keys are loaded
- Check webhook URL in Paystack dashboard
- Test card: `4084 0840 8408 4081`, CVV `408`, Expiry `12/26`

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the complete HostAfrica deployment guide.

---

## Support & Contact

- **Developer:** Emmanuel — Impact Digital (Academy & Services)
- **Website:** https://impactdigitalacademy.com.ng

---

## License

Proprietary — © 2026 Institute of Assets & Value Management Nigeria.

---

**Version:** 2.0.0
**Last updated:** October 2026