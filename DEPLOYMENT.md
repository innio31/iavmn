# IAVMN — Deployment Guide (HostAfrica)

Complete guide to deploying the IAVMN web app to HostAfrica's shared hosting with Node.js support.

**Verified working on:** HostAfrica shared hosting, cPanel with LiteSpeed/nginx reverse proxy, Node.js 20.

---

## Prerequisites

Before you start, make sure you have:

1. **HostAfrica hosting account** with Node.js support enabled
2. **cPanel access** (username + password)
3. **SSH/Terminal access** via cPanel
4. **Git repository** on GitHub (or GitLab / Bitbucket)
5. **Domain DNS** pointing to the HostAfrica nameservers
6. **Paystack account** with test + live keys
7. **Email account** created in cPanel (for SMTP)

---

## Step 1: Prepare Your Local Copy

Before deploying, verify `.gitignore` contains:

```
.env
.env.local
.env.*.local

node_modules/

public/uploads/*
!public/uploads/**/
!public/uploads/**/.gitkeep
!public/uploads/branding/
!public/uploads/branding/**

.DS_Store
Thumbs.db
*.log
npm-debug.log*

test-*.mjs
email-preview.html
iavmn-local-backup-*.sql
```

Commit and push your code:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

---

## Step 2: Set Up the MySQL Database

### 2a. Create the database

1. Log into **cPanel**
2. Go to **MySQL® Databases**
3. Create a database: `iavmn` (cPanel may prefix it — note the full name)
4. Under **MySQL Users → Add New User**:
   - Username: `iavmn_app`
   - Password: generate a strong one — **save it**
5. Under **Add User To Database**:
   - Select the user and database
   - Grant **ALL PRIVILEGES**

**Note down:**
- DB Name (with prefix if applicable)
- DB User
- DB Password
- DB Host — usually `localhost` on HostAfrica

### 2b. Import the schema (via phpMyAdmin)

1. cPanel → **phpMyAdmin**
2. Select your database
3. Click **Import** → choose `database/schema.sql` → **Go**
4. Import `database/seed-settings.sql`
5. Import all 5 files from `database/migrations/` **in order** (001 → 005)

### 2c. Verify

Expected tables (**14 total** after all imports):

```
contact_messages
council_members
faqs
hero_slides
members
membership_applications
membership_tiers
newsletter_recipients
newsletter_sends
pages
posts
settings
subscribers
testimonials
users
```

(`user_sessions` is created automatically on first app boot.)

The `settings` table should have **38 rows**.

---

## Step 3: Create the Node.js Application

### 3a. In cPanel → Setup Node.js App

Click **Create Application** and fill in:

| Field | Value |
|---|---|
| **Node.js version** | **20.x** (recommended) |
| **Application mode** | **Production** |
| **Application root** | `iavmn` |
| **Application URL** | `iavmn.org.ng` |
| **Application startup file** | `server.js` |

Click **Create**.

**Note:** cPanel may pre-populate `~/iavmn/` with placeholder files (`public/`, `server.js`, `tmp/`). We'll clean these in the next step.

### 3b. Note these values

- **Application root path** — usually `/home/USERNAME/iavmn`
- **Virtual environment command**:
  ```
  source /home/USERNAME/nodevenv/iavmn/20/bin/activate && cd /home/USERNAME/iavmn
  ```
- **Application URL** — should be `iavmn.org.ng`

### 3c. Do NOT start the app yet

Starting now will fail — no code, no dependencies.

---

## Step 4: Upload Code via Git

### 4a. Open cPanel Terminal

1. cPanel → **Terminal**
2. You land in your home directory

### 4b. Clean the app folder

The app folder usually has placeholder files cPanel created:

```bash
cd ~/iavmn
ls -la
```

You'll likely see `public/`, `server.js`, `tmp/`.

**Keep `tmp/`** — Passenger needs it. Remove the others:

```bash
rm -rf public server.js
```

### 4c. Clone into a temp folder, then move

Because `~/iavmn/` isn't empty (it has `tmp/`), we clone into a sibling and move everything:

```bash
cd ~
git clone https://github.com/YOUR-USERNAME/iavmn.git iavmn-clone
cp -r ~/iavmn-clone/. ~/iavmn/
rm -rf ~/iavmn-clone
cd ~/iavmn
```

Verify:

```bash
ls -la
git status
```

**Expected**: `.git`, `.gitignore`, `README.md`, `package.json`, `server.js`, `src/`, `public/`, `database/`, `tmp/`, plus the four docs. `git status` shows "clean working tree" (except `tmp/` which is untracked — that's fine).

### 4d. If git asks for authentication

GitHub no longer accepts passwords. You need a **Personal Access Token**:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use the token as the password when git prompts

Or set up SSH keys (more secure, more setup).

---

## Step 5: Create the Production `.env`

### 5a. Create the file

```bash
cd ~/iavmn
nano .env
```

### 5b. Paste this template (then replace the placeholders)

```env
NODE_ENV=production
PORT=3000
APP_NAME=IAVMN
APP_URL=https://yourdomain.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=YOUR_DB_NAME

SESSION_SECRET=REPLACE_WITH_A_LONG_RANDOM_STRING
SESSION_MAX_AGE_MS=86400000

MAIL_HOST=mail.yourdomain.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=info@yourdomain.com
MAIL_PASS=YOUR_EMAIL_PASSWORD
MAIL_FROM_NAME=IAVMN
MAIL_FROM_EMAIL=info@yourdomain.com

PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx

UPLOAD_DIR=public/uploads
MAX_UPLOAD_MB=5
```

### 5c. Generate the session secret

In a second terminal tab:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output into `SESSION_SECRET`.

### 5d. Save and lock down

- **Ctrl+O** → Enter (save)
- **Ctrl+X** (exit)
- `chmod 600 .env` (only owner can read)

Verify:

```bash
grep -E "^(APP_URL|MAIL_HOST|MAIL_USER)=" .env
```

---

## Step 6: Install Dependencies

### 6a. Activate the venv

```bash
source /home/USERNAME/nodevenv/iavmn/20/bin/activate && cd ~/iavmn
```

**Note:** The venv must be activated in every new terminal session. Your prompt should show `(iavmn:20)`.

### 6b. Verify Node version

```bash
node -v
npm -v
```

**Expected**: Node 20.x, npm 10.x

### 6c. Install

```bash
npm install
```

**Expected**: 2–5 minutes, ends with "added XXX packages".

**Note:** `npm install --production` is deprecated — use `npm install` and cPanel handles the rest.

### 6d. Verify

```bash
ls node_modules | grep -E "^(express|mysql2|ejs|bcrypt|nodemailer|pdfkit|qrcode|helmet|multer)$"
```

**Expected**: all 9 packages listed.

---

## Step 7: Start the App

Back in cPanel → **Setup Node.js App** → find your app → click **Restart**.

Wait 10–15 seconds. The page should show the app as **Running**.

---

## Step 8: First Boot Test & Common Issues

### 8a. Try the site

Open `https://yourdomain.com/` in a browser.

### ⚠️ Issue: cPanel placeholder `index.html` intercepts the homepage

**Symptom**: `/setup` works but `/` shows a HostAfrica "domain registered" placeholder.

**Cause**: Apache serves a static `index.html` in `public_html/` before Passenger gets a chance.

**Fix**:

```bash
ls -la ~/domains/YOURDOMAIN.com/public_html/
rm ~/domains/YOURDOMAIN.com/public_html/index.html
rm ~/domains/YOURDOMAIN.com/public_html/index.php 2>/dev/null
```

**Keep** `.htaccess` — that's the Passenger forwarding config.

### 8b. Complete first-time setup

Once the site loads, visit:

```
https://yourdomain.com/setup
```

Create your super admin account with a **strong, unique password**.

**After setup, `/setup` returns 404 forever** — this is a security measure.

### 8c. Log in

Test logging in at `/login`. If successful, you land on `/admin`.

---

## Step 9: Common Login Issue — `trust proxy`

**Symptom**: Login redirects to `/admin`, then immediately bounces back to `/login`. No error message. `user_sessions` has rows but the session doesn't persist.

**Cause**: HostAfrica runs nginx/LiteSpeed in front of Node. Express thinks requests are HTTP even when visitors are on HTTPS, so **Secure session cookies are never sent**.

**Fix**: `server.js` must contain:

```js
app.set('trust proxy', 1);
```

And the session config must include:

```js
proxy: true,
```

Both are already in the current `server.js`. If they're ever removed, this bug returns.

---

## Step 10: Set Up Email

### 10a. Confirm the mail account

cPanel → **Email Accounts** → verify `info@yourdomain.com` exists.

### 10b. Find the correct SMTP host

cPanel → **Email Accounts** → click **Connect Devices** next to your email. Look for:

- **Outgoing Server** (e.g., `mail.yourdomain.com`)
- **Outgoing Port** (usually 465 SSL or 587 STARTTLS)

Update `.env` if different from what's already there.

### 10c. Fix the "certificate expired" issue

Some HostAfrica mail servers have expired SSL certificates. The app works around this in `mailer.js` with:

```js
tls: {
  rejectUnauthorized: false,
  servername: host,
},
```

**Do not remove** until HostAfrica renews the certificate.

### 10d. Test

```bash
node -e "import('./src/services/mailer.js').then(m => m.sendMail({ to: 'you@example.com', subject: 'Test', html: '<p>Test from IAVMN</p>' }))"
```

**Expected**: `[mailer] sent: <messageId>` — and the email arrives.

### 10e. Set up SPF/DKIM

**Purpose**: prevents emails from landing in spam.

1. In cPanel, search for **Email Deliverability**
2. If available, click **Manage** next to the domain
3. Install the suggested **SPF** and **DKIM** records
4. Wait 15 minutes for DNS propagation

**If Email Deliverability is not available**: open a HostAfrica support ticket asking them to enable it. Some hosting plans hide it when the domain uses external DNS.

---

## Step 11: Set Up Paystack

### 11a. Test mode first

Keep `pk_test_*` and `sk_test_*` in `.env` initially. Confirm the mock checkout flow works.

### 11b. Live keys

When ready:

1. Log into https://dashboard.paystack.com
2. **Settings → API Keys & Webhooks**
3. Copy the **Live Public Key** and **Live Secret Key**
4. Edit `.env`:
   ```bash
   nano ~/iavmn/.env
   ```
5. Replace with `pk_live_*` and `sk_live_*`
6. Save (Ctrl+O, Enter, Ctrl+X)
7. Restart the app in cPanel

### 11c. Set the webhook URL

Paystack dashboard → **Webhook URL**:

```
https://yourdomain.com/webhooks/paystack
```

### 11d. Test

- Visit `/admin/paystack-test` — should show "Configured: Yes"
- Run a small test transaction (₦100) with a real card
- Verify the application is marked **Paid** and the receipt email arrives

---

## Step 12: SSL / HTTPS

HostAfrica provides free Let's Encrypt SSL.

1. cPanel → **SSL/TLS Status**
2. Find your domain → **Run AutoSSL**
3. Wait 5 minutes

Once HTTPS works:
- `NODE_ENV=production` should already be set (via `.env` or cPanel env vars)
- Session cookies automatically get the `Secure` flag

**Verify** the padlock icon appears in the browser.

---

## Step 13: Set Up Backups

### 13a. Create a backups folder

```bash
mkdir -p ~/backups
```

### 13b. Add cron jobs

cPanel → **Cron Jobs**:

**Daily DB backup (3:00 AM)**:
```
0 3 * * * mysqldump -u DB_USER -p'DB_PASSWORD' DB_NAME | gzip > /home/USER/backups/db-$(date +\%Y\%m\%d).sql.gz
```

**Daily uploads backup (3:30 AM)**:
```
30 3 * * * tar czf /home/USER/backups/uploads-$(date +\%Y\%m\%d).tar.gz -C /home/USER/iavmn/public uploads
```

### 13c. Weekly off-site download

Every Sunday, download the latest backups from cPanel → **File Manager** → `~/backups/`. Store them locally or in cloud storage.

---

## Step 14: Post-Launch Checklist

Run through this list before considering the deployment complete:

- [ ] Home page loads with logo, hero, membership cards
- [ ] All navigation links work
- [ ] Mobile view works (test at 360×640)
- [ ] Admin login works
- [ ] Dashboard shows stats
- [ ] Settings save correctly
- [ ] Uploading images works
- [ ] Contact form sends email
- [ ] Newsletter subscribe sends welcome email
- [ ] Search finds results
- [ ] Membership application saves
- [ ] Payment completes (test mode or live)
- [ ] Approval creates member + sends welcome email
- [ ] Member can log in to portal
- [ ] Certificate PDF downloads with QR code
- [ ] QR code opens verification page
- [ ] Sitemap.xml is served
- [ ] robots.txt is served
- [ ] Real-time pill shows "Live"
- [ ] Toast notifications appear

---

## Step 15: Production Notes

### Session cookie name: `iavmn.sid`

To log out all users, delete rows from `user_sessions`.

### Polling vs SSE

The admin notification system uses **polling every 15 seconds** (`/admin/events/poll`), not Server-Sent Events. SSE doesn't work reliably through HostAfrica's LiteSpeed proxy — it buffers the response and events never arrive.

### Email URL injection

EJS templates **do not have access to `process.env`**. The `mailer.js` service injects `appUrl` into every template's render data. Templates should use `appUrl` (not `process.env.APP_URL`).

### Favicon at root

`public/favicon.ico` must exist. Browsers request it at the domain root regardless of any `<link rel="icon">` tag.

### `responsive-helpers.css`

Contains `.hide-mobile` and `.show-mobile`. Loaded in every layout. **Do not remove**.

---

## Updating the App After Launch

```bash
cd ~/iavmn
git pull origin main
npm install          # if package.json changed
# Then in cPanel, click Restart
```

**The app does not restart automatically.** Any code change requires a manual restart via cPanel.

---

## Rolling Back

If a deployment breaks:

```bash
cd ~/iavmn
git log --oneline            # find the previous commit hash
git checkout <hash>
npm install
# Restart in cPanel
```

When fixed:

```bash
git checkout main
git pull
# Restart in cPanel
```

---

## Troubleshooting Quick Reference

| Symptom | Cause | Fix |
|---|---|---|
| App won't start | Missing deps, wrong env, bad DB creds | Check stderr.log in app root |
| 503 Service Unavailable | Passenger can't reach the app | Check `npm install` succeeded; verify `.env` |
| 500 errors | App crash or DB error | Check stderr.log |
| Login loops back to `/login` | Missing `trust proxy` | Verify `server.js` |
| Images 404 | Uploads folder not writable | `chmod 775 public/uploads` |
| Emails not sending | Wrong SMTP credentials | Test with the mailer one-liner |
| Emails contain `localhost` URLs | `appUrl` not injected | Check `mailer.js` |
| Emails land in spam | SPF/DKIM missing | Set up in cPanel |
| Paystack not configured | Keys missing/wrong prefix | Check `/admin/paystack-test` |
| Random 502 errors | Memory pressure | Reduce `connectionLimit` in `db.js` |
| Real-time pill stuck on "Connecting" | Polling endpoint not reachable | Check Network tab for `/admin/events/poll` |

---

## Support

- **HostAfrica:** https://hostafrica.com/support
- **Paystack:** https://paystack.com/support
- **Developer:** Impact Digital — https://impactdigitalacademy.com.ng

---

**Last updated:** October 2026
**Deployed on:** HostAfrica shared hosting (Node.js 20, LiteSpeed)