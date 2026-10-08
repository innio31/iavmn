# IAVMN — Institute of Assets & Value Management Nigeria

A dynamic, admin-managed website for the Institute of Assets & Value Management Nigeria (IAVMN).

Built with **Node.js + Express + EJS + MySQL**. Content is fully manageable from an admin dashboard — no code changes needed to update the site.

---

## What This App Does

### Public site

- **Home page** — dynamic hero slider, about section, membership cards, testimonials, latest news
- **Council Members** — listing with photos and individual profile pages
- **Membership Tiers** — Student, Associate, Corporate, Fellow (fully configurable)
- **Membership Applications** — online form with CV + passport photo upload, unique reference generation, and **Paystack payment integration**
- **News & Updates** — blog with cover images, excerpts, and pagination
- **FAQ** — accordion page with searchable questions
- **Contact** — form with admin notification + auto-acknowledgement email
- **Newsletter** — footer subscribe form with welcome email and unsubscribe link
- **Editable pages** — About, Privacy Policy, Terms, Vision, etc.
- **SEO-ready** — meta tags, Open Graph, sitemap.xml, robots.txt

### Admin dashboard

Everything below is manageable from `/admin`:

- **Settings** — site name, contact details, social links, email config, Paystack toggle
- **Hero Slides** — carousel with image upload and ordering
- **Membership Tiers** — name, fee, currency, icon, description, publish status
- **Council Members** — profiles with photo, bio, LinkedIn, email
- **Pages** — editable content pages with optional "show in menu" toggle
- **FAQs** — questions and answers
- **Testimonials** — quotes with optional author photo
- **Posts** — news/blog with cover image, excerpt, publish scheduling
- **Applications** — review, approve/reject, view CVs and photos
- **Subscribers** — newsletter list with CSV export
- **Contact Messages** — inbox with read/unread, reply-by-email
- **Admin Users** — multi-user with role-based access (super_admin, admin, editor, membership_officer)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
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
| Security | Helmet, parameterized queries, CSRF-adjacent protections |

---

## Project Structure

```
iavmn/
├── server.js                 # App entry point (no routes, no logic)
├── package.json
├── .env                      # Secrets (never commit)
├── .env.example              # Template
├── README.md
├── DEPLOYMENT.md
├── database/
│   ├── schema.sql            # Full DB schema
│   ├── seed-settings.sql     # Default settings
│   └── migrations/
│       └── 001-add-menu-fields-to-pages.sql
├── public/
│   ├── css/
│   │   ├── theme.css         # Public styles
│   │   ├── admin.css         # Admin styles
│   │   └── auth.css          # Login / setup styles
│   ├── robots.txt
│   └── uploads/
│       ├── branding/         # Logo, favicon
│       ├── hero/             # Hero slider images
│       ├── council/          # Council member photos
│       ├── testimonials/     # Testimonial author photos
│       ├── posts/            # Blog cover images
│       └── applications/     # Applicant CVs and photos
└── src/
    ├── db.js                 # MySQL pool + query helpers
    ├── routes.js             # All routes
    ├── controllers/          # Request handlers
    ├── models/               # Database access (no logic)
    ├── middleware/           # Auth, flash, uploads, settings, counts
    ├── services/             # Mailer, Paystack
    ├── utils/                # File cleanup
    └── views/
        ├── layouts/          # main, admin, auth
        ├── partials/         # header, footer
        ├── errors/           # 403, 404, 500
        ├── admin/            # Admin views per module
        ├── emails/           # Email templates
        └── *.ejs             # Public pages
```

---

## Running Locally

### Prerequisites

- **Node.js 18+** — https://nodejs.org
- **MySQL 8+** (or MariaDB 10.4+) — use XAMPP on Windows for simplicity: https://www.apachefriends.org
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
   - Import `database/migrations/001-add-menu-fields-to-pages.sql`

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

**Note:** `.ejs` files reload on every request automatically. `.js` files need a restart (which `npm run dev` handles).

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
| `PAYSTACK_PUBLIC_KEY` | Paystack public key (`pk_test_...` or `pk_live_...`) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_test_...` or `sk_live_...`) |
| `UPLOAD_DIR` | Upload folder (default `public/uploads`) |
| `MAX_UPLOAD_MB` | Max upload size (default 5) |

### Dev-mode fallbacks

- **No SMTP configured** → emails print to the console instead of sending
- **No Paystack keys** → a mock checkout page simulates successful payments
- **No favicon** → the browser shows the default

This means the app **works out of the box** with just a database. Real email and payments only need the keys.

---

## Editing Content

**Everything is managed from the admin dashboard at `/admin`.**

You should never need to edit files to change content. Instead:

- Change the site name → `/admin/settings` → General tab
- Add a hero slide → `/admin/hero/new`
- Update a council member → `/admin/council`
- Publish a news post → `/admin/posts/new`
- Review an application → `/admin/applications`
- See unread messages → `/admin/messages`

Uploads (images, CVs) are handled from the browser. No FTP, no file paths.

---

## Roles & Permissions

| Role | Can do |
|---|---|
| `super_admin` | Everything + manage other admin users |
| `admin` | Everything except user management |
| `editor` | Manage content (pages, posts, hero, tiers, council, FAQs, testimonials) |
| `membership_officer` | Review applications + view members; no content editing |

New admin users are created only by a super_admin from `/admin/users` *(feature: coming soon — currently you can create admins via the setup flow or a database insert)*.

---

## Email Setup

The app uses **Nodemailer with SMTP**. Any SMTP provider works:

- **HostAfrica email** — `mail.yourdomain.com`, port 465 SSL
- **Zoho Mail** — `smtp.zoho.com`, port 465 SSL (free tier available)
- **Gmail / Google Workspace** — `smtp.gmail.com`, port 587, app-specific password
- **SendGrid / Mailgun / Postmark** — dedicated transactional email services

Set `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS` in `.env`.

### What gets emailed

| Event | Recipient |
|---|---|
| Contact form submitted | Admin + sender acknowledgement |
| Newsletter subscribe | Welcome email to the subscriber |
| Membership application submitted | Admin + applicant |
| Payment successful | Admin + applicant |
| Application approved/rejected | Applicant |

All email sending is wrapped in try/catch — user-facing actions **never** fail because email failed.

### Deliverability

For best deliverability, set up **SPF**, **DKIM**, and **DMARC** records in cPanel → **Email Deliverability**. Without them, some emails may land in spam on first send.

---

## Paystack Setup

1. Create a Paystack account: https://paystack.com
2. Get API keys: **Settings → API Keys & Webhooks**
3. Add to `.env`:
   ```env
   PAYSTACK_PUBLIC_KEY=pk_test_...
   PAYSTACK_SECRET_KEY=sk_test_...
   ```
4. Set webhook URL in Paystack dashboard:
   ```
   https://yourdomain.com/webhooks/paystack
   ```
5. Test with Paystack's test cards before going live

When keys are absent, the app uses a **mock checkout page** so you can still test the full flow.

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for a complete HostAfrica deployment guide, including:

- MySQL setup in cPanel
- Node.js app creation
- Environment variables
- File permissions
- SSL, backups, cron
- Troubleshooting

---

## Security Notes

- **Passwords** — hashed with bcrypt (12 rounds), never stored plaintext
- **SQL** — all queries use parameterized statements (`?` placeholders), no string concatenation
- **Sessions** — server-side, stored in MySQL, HTTP-only cookies, regenerated on login
- **Role checks** — server-side via middleware; hidden links are never trusted
- **Uploads** — MIME-type validated, filenames sanitized, size-limited
- **Path traversal** — file deletion utility refuses paths outside `public/uploads/`
- **CSRF-adjacent** — admin routes require login + role; forms use POST + session (safe against most CSRF)
- **Emails** — SMTP credentials only server-side; never exposed to browser

### Known workarounds

- **HostAfrica's mail certificate is expired** — `mailer.js` uses `rejectUnauthorized: false` for SMTP. Remove this once the certificate is renewed. Documented in `.env` comments.

---

## Backup & Restore

### Backup

```bash
# Database
mysqldump -u DB_USER -p DB_NAME > backup-$(date +%Y%m%d).sql

# Uploads
tar czf uploads-$(date +%Y%m%d).tar.gz public/uploads/
```

### Restore

```bash
mysql -u DB_USER -p DB_NAME < backup.sql
tar xzf uploads-backup.tar.gz
```

See `DEPLOYMENT.md` for automated cron-based backups.

---

## Troubleshooting

### Server won't start

- Run `node server.js` directly and read the error
- Check for missing `.env` values
- Verify MySQL is running and the database exists

### Emails not sending

- Test with: `node -e "import('./src/services/mailer.js').then(m => m.sendMail({ to: 'you@example.com', subject: 'Test', html: '<p>Hi</p>' }))"`
- If it prints to console → SMTP not configured (check `.env`)
- If it errors → check the error message (auth, timeout, etc.)

### Uploads fail

- Check `public/uploads/` exists and is writable
- Check the file type is allowed (JPG, PNG, WEBP, GIF, PDF, DOC, DOCX)
- Check the file size is under 5 MB

### Sessions log out too fast

- Check `SESSION_MAX_AGE_MS` is a reasonable value (86400000 = 24 hours)
- Verify `user_sessions` table exists in the DB

### Paystack not working

- Visit `/admin/paystack-test` to see if keys are loaded
- Check the webhook URL is set in the Paystack dashboard
- Try the test card: `4084 0840 8408 4081`, CVV `408`, Expiry `12/26`

---

## Support & Contact

For issues with this app:

- **Developer:** Emmanuel — Impact Digital (Academy & Services)
- **Website:** https://impactdigitalacademy.com.ng

For issues with hosting, email, or payments:

- **HostAfrica:** https://hostafrica.com/support
- **Paystack:** https://paystack.com/support

---

## License

Proprietary — © 2026 Institute of Assets & Value Management Nigeria.

---

**Version:** 1.0.0
**Last updated:** 2026-10-04