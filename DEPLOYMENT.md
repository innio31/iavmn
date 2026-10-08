# IAVMN — Deployment Guide (HostAfrica)

This guide walks you through deploying the IAVMN web app to HostAfrica's shared hosting with Node.js support.

---

## Prerequisites

Before you start, make sure you have:

1. **HostAfrica hosting account** with Node.js support enabled
2. **cPanel access** (username + password)
3. **SSH access** — HostAfrica typically supports SSH on request; if not, you'll use cPanel's Terminal
4. **Git repository** with the code (GitHub, GitLab, or Bitbucket)
5. **Domain DNS** pointing to HostAfrica
6. **Paystack account** with test + live keys
7. **Email account** created in cPanel (for SMTP)

---

## Step 1: Prepare Your Local Copy

Before deploying, make sure your `.env` file does **not** get uploaded. Verify `.gitignore` contains:

```
.env
node_modules/
public/uploads/*
!public/uploads/**/
!public/uploads/**/.gitkeep
```

Commit and push your code to your Git repository:

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
3. Under **Create New Database**:
   - Database name: `iavmn` (cPanel will prefix it, e.g. `impactdi_iavmn`)
   - Click **Create Database**
4. Under **MySQL Users → Add New User**:
   - Username: `iavmn_app` (cPanel will prefix it)
   - Password: generate a strong password — **save it**
   - Click **Create User**
5. Under **Add User To Database**:
   - Select the user and database
   - Click **Add**
   - Grant **ALL PRIVILEGES**
   - Click **Make Changes**

**Note these values:**
- DB Name: `impactdi_iavmn`
- DB User: `impactdi_iavmn_app`
- DB Password: `(the password you saved)`
- DB Host: `localhost` (HostAfrica's MySQL runs locally on the same server)

### 2b. Import the schema

1. In cPanel, open **phpMyAdmin**
2. Select your new database from the left sidebar
3. Click the **Import** tab
4. Upload `database/schema.sql` → click **Go**
5. Upload `database/seed-settings.sql` → click **Go**
6. Upload `database/migrations/001-add-menu-fields-to-pages.sql` → click **Go**

### 2c. Verify tables

You should see these tables in phpMyAdmin:
- `contact_messages`
- `faqs`
- `hero_slides`
- `membership_applications`
- `membership_tiers`
- `pages`
- `posts`
- `settings`
- `subscribers`
- `testimonials`
- `users`

(`user_sessions` is auto-created on first app start.)

---

## Step 3: Set Up the Node.js Application

HostAfrica uses **cPanel's "Setup Node.js App"** feature.

### 3a. Create the app

1. In cPanel, search for **Setup Node.js App** (under "Software")
2. Click **Create Application**
3. Fill in:
   - **Node.js version:** 20.x or higher (HostAfrica usually offers 18.x, 20.x, 22.x)
   - **Application mode:** Production
   - **Application root:** `iavmn` (or your preferred folder name — this will be created under your home dir)
   - **Application URL:** `iavmn.org` (or your domain)
   - **Application startup file:** `server.js`
4. Click **Create**

cPanel will create a folder like `/home/username/iavmn/` and generate a `Passengerfile` or starter setup.

### 3b. Upload your code

You have two options:

**Option A — Git clone (recommended)**

1. Open cPanel's **Terminal** (or SSH into the server)
2. Navigate to your app root:
   ```bash
   cd ~/iavmn
   ```
3. Clone your repo:
   ```bash
   git clone https://github.com/yourusername/iavmn.git .
   ```
   (The `.` at the end clones into the current folder)

**Option B — File Manager upload**

1. Zip your project locally (exclude `node_modules/` and `.env`)
2. In cPanel → **File Manager** → navigate to `iavmn/`
3. Upload the zip
4. Right-click → **Extract**
5. Delete the zip

### 3c. Verify the file structure

```bash
ls -la ~/iavmn
```

You should see:
```
server.js
package.json
src/
public/
database/
.env.example
```

---

## Step 4: Configure Environment Variables

In cPanel's **Setup Node.js App** page for your app:

1. Scroll to **Environment variables**
2. Add these variables one by one:

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or leave blank — Passenger sets it automatically) |
| `APP_NAME` | `IAVMN` |
| `APP_URL` | `https://iavmn.org` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `impactdi_iavmn_app` |
| `DB_PASSWORD` | *(the DB password)* |
| `DB_NAME` | `impactdi_iavmn` |
| `SESSION_SECRET` | *(generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)* |
| `SESSION_MAX_AGE_MS` | `86400000` |
| `MAIL_HOST` | `mail.acad.com.ng` |
| `MAIL_PORT` | `465` |
| `MAIL_SECURE` | `true` |
| `MAIL_USER` | `schools@acad.com.ng` |
| `MAIL_PASS` | *(the email password)* |
| `MAIL_FROM_NAME` | `IAVMN` |
| `MAIL_FROM_EMAIL` | `schools@acad.com.ng` |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_...` |
| `PAYSTACK_SECRET_KEY` | `sk_live_...` |
| `UPLOAD_DIR` | `public/uploads` |
| `MAX_UPLOAD_MB` | `5` |

3. Click **Save**

---

## Step 5: Install Dependencies

In **Setup Node.js App**, click **Run NPM Install**.

Wait for it to complete — should take 1–3 minutes. When done, the button shows **Run JS script** instead.

If it fails:
- Open cPanel Terminal: `cd ~/iavmn && npm install --production`
- Paste any error message and troubleshoot from there

---

## Step 6: Set File Permissions

Uploads need to be writable by the Node.js process.

In cPanel Terminal:

```bash
cd ~/iavmn
chmod -R 755 public/uploads
```

If uploads fail later, you may need:

```bash
chmod -R 775 public/uploads
```

---

## Step 7: Start the Application

Back in **Setup Node.js App**:

1. Click **Restart** (or **Start**)
2. Wait a few seconds
3. Visit your domain: `https://iavmn.org`

### First-time setup

Since the users table is empty, visiting any admin URL will redirect you. Go to:

```
https://iavmn.org/setup
```

Create your super admin account. **Once complete, `/setup` becomes a 404 forever.**

---

## Step 8: Verify Everything Works

Run through this checklist:

- [ ] Home page loads
- [ ] Images load (uploaded files appear)
- [ ] Navigation works on mobile
- [ ] `/setup` was used to create your admin
- [ ] Login works at `/login`
- [ ] `/admin` dashboard renders
- [ ] You can upload a hero slide image
- [ ] You can publish a post
- [ ] Contact form sends email (check the recipient's inbox)
- [ ] Newsletter subscribe sends a welcome email
- [ ] Membership application submits successfully
- [ ] Paystack test payment completes
- [ ] Admin receives application + payment notifications

---

## Step 9: Set Up Paystack Webhook

1. Log into https://dashboard.paystack.com
2. Go to **Settings → API Keys & Webhooks**
3. Set **Webhook URL:**
   ```
   https://iavmn.org/webhooks/paystack
   ```
4. Click **Save**

Now Paystack will POST to your app on every successful transaction — a belt-and-braces confirmation in addition to the browser callback.

### Testing the webhook

Paystack has a "Send test webhook" option. Use it to verify your endpoint receives events.

---

## Step 10: SSL Certificate

HostAfrica usually provides free Let's Encrypt SSL. To enable:

1. cPanel → **SSL/TLS Status**
2. Find your domain
3. Click **Run AutoSSL**

Wait 5 minutes, then visit `https://iavmn.org`. The padlock should appear.

**Important:** Once HTTPS works, edit `server.js` to set `secure: true` for session cookies. Currently it reads `NODE_ENV=production` to decide — verify in cPanel env vars that `NODE_ENV=production`.

---

## Step 11: Set Up Automatic Backups (Recommended)

### Database backups

1. cPanel → **Cron Jobs**
2. Add a daily job:
   ```
   0 3 * * * mysqldump -u impactdi_iavmn_app -p'YOUR_DB_PASSWORD' impactdi_iavmn | gzip > /home/username/backups/db-$(date +\%Y\%m\%d).sql.gz
   ```
3. Create the backups folder first:
   ```bash
   mkdir -p ~/backups
   ```

### File backups

1. Cron job for uploads:
   ```
   30 3 * * * tar czf /home/username/backups/uploads-$(date +\%Y\%m\%d).tar.gz -C /home/username/iavmn/public uploads
   ```

### Off-site backup (optional)

Use cPanel's **Backup Wizard** to download a full backup weekly.

---

## Step 12: Monitor & Maintain

### Check logs

If something breaks, look for:

- **App logs:** cPanel → **Setup Node.js App** → **Log file** (or check `stderr.log` in the app root)
- **Error logs:** cPanel → **Errors** (under Metrics)
- **MySQL logs:** rare on shared hosting, but cPanel → **MySQL → Logs** if available

### Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| "Cannot GET /" or 503 | App crashed on startup | Check logs in Node.js App page |
| 500 errors on every page | Missing env var or DB connection issue | Verify env vars; test DB connection |
| Images 404 | Uploads folder not writable | `chmod 775 public/uploads` |
| Emails not sending | SMTP credentials wrong or certificate issue | Test with a mailer script; contact HostAfrica if cert expired |
| Sessions log out constantly | Session store not working | Check `user_sessions` table exists in DB |
| Paystack "invalid signature" | Wrong secret key or webhook URL | Recheck `.env` and Paystack dashboard |
| Random 502 errors | Node process OOM or crashing | Check memory usage; reduce `connectionLimit` in `db.js` |

### Restarting the app

In **Setup Node.js App**, click **Restart** after any code change.

### Deploying updates

```bash
cd ~/iavmn
git pull
npm install --production
# Then in cPanel, click Restart
```

---

## Step 13: Post-Launch Checklist

- [ ] Test on real mobile device
- [ ] Verify all emails arrive (check spam folders)
- [ ] Update `settings` in admin with real phone, address, socials
- [ ] Upload real logo, favicon, hero slides
- [ ] Replace placeholder text on pages
- [ ] Add real council members
- [ ] Create the four membership tiers with correct fees
- [ ] Test one real Paystack transaction (small amount) with live keys
- [ ] Add `https://iavmn.org/sitemap.xml` to Google Search Console
- [ ] Add the site to Google Analytics (optional — add snippet to `layouts/main.ejs`)
- [ ] Set up SPF / DKIM records in cPanel → **Email Deliverability**
- [ ] Test the "forgot password" flow — **note:** not yet implemented; admin password change is manual for now

---

## Troubleshooting Deep Dive

### App won't start

Open **Setup Node.js App** → check the error output. Common causes:

1. **Missing `node_modules`** → Run NPM Install again
2. **Wrong Node version** → set the correct version in the app settings
3. **Import error** → you forgot to push a file; `git pull` again
4. **`.env` not found** → env vars must be set in the cPanel UI (not uploaded as a file, unless you upload `.env` manually to the app root)

### Manual `.env` (alternative to UI env vars)

If you prefer a `.env` file over cPanel's UI:

1. Create `.env` locally with all values
2. Upload to `~/iavmn/.env` via File Manager
3. `chmod 600 ~/iavmn/.env` (only your user can read it)
4. Restart the app

Either approach works; just don't have both (cPanel env vars override `.env` in Node).

### Database connection refused

If you see `ECONNREFUSED` or `Access denied`:

1. Verify DB credentials in cPanel → MySQL Databases
2. Test from cPanel Terminal:
   ```bash
   mysql -u impactdi_iavmn_app -p -h localhost impactdi_iavmn
   ```
3. If that works but Node doesn't, check `.env` / env vars have no typos

### Session issues

Users getting logged out randomly usually means:

1. Session store is memory-based (it's not — we use MySQL)
2. `user_sessions` table is missing — check phpMyAdmin
3. Multiple instances running — passenger handles one process, so this is unlikely

If issues persist, verify `SESSION_SECRET` is a real value (not `dev-secret-change-me-later`).

---

## Rolling Back

If a deployment breaks things:

```bash
cd ~/iavmn
git log --oneline        # find the previous commit hash
git checkout <hash>
npm install --production
# Then click Restart in cPanel
```

Once the issue is fixed:

```bash
git checkout main
git pull
```

---

## Support

- **HostAfrica support:** https://hostafrica.com/support
- **Paystack support:** https://paystack.com/support
- **Project repo:** *(add your repo URL)*

---

**Last updated:** 2026-10-04