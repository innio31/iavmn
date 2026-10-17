# IAVMN — Launch Handover

**From:** Impact Digital (Academy & Services)
**To:** Institute of Assets & Value Management Nigeria
**Date:** October 2026
**Website:** https://iavmn.org.ng

---

## 1. What You Now Have

Your organisation now has a **fully dynamic, self-managed website** — you can update everything from a secure admin dashboard without needing a developer.

### The public website

- **Homepage** with image carousel, membership cards, testimonials, latest news
- **Council members** with photo, biography, contact details
- **Membership tiers** — Student, Associate, Corporate, Fellow (each with its own fees and description)
- **Online membership applications** with CV and photo upload
- **Paystack payment integration** — secure online payments via card, bank transfer, and USSD
- **Member portal** — approved members can log in and manage their own account
- **Downloadable certificate PDF** with a QR code for public verification
- **Public verification page** at `/verify` — anyone can confirm a member is legitimate by scanning the QR code
- **News & updates** with cover images and social sharing
- **FAQs** with expandable questions
- **Contact form** with automatic email notifications
- **Newsletter** with welcome emails and one-click unsubscribe
- **Site-wide search** — searches news, pages, FAQs, council members, and tiers
- **Installable as a mobile app** (PWA) — visitors can add IAVMN to their home screen

### The admin dashboard (at `/admin`)

Manage everything without touching code:

- **Site settings** — name, contact info, social links, analytics, SEO
- **Homepage carousel** — upload and reorder slides
- **Membership tiers** — edit fees, descriptions, publish/hide
- **Council members** — full profiles with photos
- **Content pages** — About, Privacy, Terms, Vision, and any custom page
- **FAQs** — questions and answers
- **Testimonials** — member quotes with optional photos
- **News posts** — write and publish, with cover images and scheduling
- **Membership applications** — review, approve, reject, with CV and photo access
- **Members** — view, edit status, extend/reduce membership, reset passwords
- **Newsletter** — compose and send campaigns to all subscribers
- **Contact messages** — read, reply, mark as read
- **Admin users** — create multiple admin accounts with different access levels

### Automated features

- **Email notifications** for every important event (new application, payment received, approval, etc.)
- **Real-time admin alerts** — when a form is submitted, a small notification appears on your dashboard within seconds
- **PDF certificate generation** — automatic, with a unique QR code per member
- **QR verification** — anyone can verify a member's status on a public page

---

## 2. What to Do Now

### Immediate (before you invite real users)

1. **Log in to `/admin`** — go to https://iavmn.org.ng/admin and sign in with the super admin credentials you created
2. **Set your real contact details** — Settings → Contact (phone, email, address, hours)
3. **Add your social links** — Settings → Social (Facebook, LinkedIn, etc.)
4. **Upload your real logo** if you haven't already — contact your developer for assistance if needed
5. **Review the About page** — Pages → About → update with your real institutional content
6. **Add FAQs** — FAQs → + New FAQ (start with the 5 most common questions)
7. **Review your membership tiers** — Tiers (adjust fees, descriptions if needed)

### Within the first week

8. **Add council members** — Council Members → + New Member (photo + bio for each)
9. **Add testimonials** — Testimonials → + New Testimonial (ask 3–5 members for a quote)
10. **Write a welcome post** — Posts → + New Post (announce the new website)
11. **Test the application flow yourself** — go through `/membership/student/apply` end-to-end
12. **Test the newsletter** — Newsletter → compose a test, send to yourself first
13. **Verify your email deliverability** — check that notification emails arrive in the inbox, not spam (your developer is handling SPF/DKIM setup)

### When you're ready for real payments

14. **Get your Paystack live keys** — log in to https://dashboard.paystack.com → Settings → API Keys
15. **Provide them to your developer** to swap into the production environment
16. **Set the webhook URL in Paystack** to: `https://iavmn.org.ng/webhooks/paystack`
17. **Run one small live transaction** as a real test (₦100 to yourself, refund after)

---

## 3. What to Watch For

### Emails

- **Most emails should land in the inbox** — but until SPF/DKIM is fully set up, some may occasionally land in spam
- **Ask new members** to check their spam folder if they say they didn't receive a welcome email
- **Monitor the admin inbox** at `info@iavmn.org.ng` — all system notifications go there

### Payments

- **Paystack sends settlements** to your designated bank account (usually T+1 business day)
- **Refunds must be done in the Paystack dashboard**, not on the website
- **Keep the app running** — if the Node.js app stops, payments won't work

### Members

- **Renewal reminders are manual** — you'll need to send these yourself (or ask your developer to add automated renewal reminders later)
- **Certificates are downloadable** at any time — but only while a member is active
- **Suspended or expired members** can't log in — their portal access is blocked

### Backups

- **Your developer has set up daily backups** — database + uploads folder
- **Download weekly off-site backups** from cPanel → Backup Wizard (recommended for safety)

---

## 4. What Still Needs to Be Done (Optional Enhancements)

These are not blockers — your site is fully functional without them. They're improvements to consider later:

- **SPF/DKIM email authentication** (in progress — HostAfrica support ticket submitted)
- **Google Analytics tracking** (form is built into Settings → Analytics & SEO; just paste your GA4 ID)
- **Google Search Console** — add your site so Google indexes it properly
- **Service worker with offline mode** (already added)
- **PWA install button** (already added)
- **Member renewal reminders** (automated emails 30 days before expiry — small feature, ask developer)
- **Certificate for expired members** (currently only active members can download)
- **Multi-language support** (only relevant if you want it)

---

## 5. Support & Contacts

**Developer:**
Emmanuel — Impact Digital (Academy & Services)
https://impactdigitalacademy.com.ng

**Hosting:**
HostAfrica
https://hostafrica.com/support
Panel: https://panel.hostafrica.com

**Payments:**
Paystack
https://paystack.com/support

**Email Service:**
Provided through HostAfrica cPanel

---

## 6. Access Details

Keep these in a secure password manager:

| What | Where | Notes |
|---|---|---|
| **Admin dashboard** | https://iavmn.org.ng/admin | Your super admin credentials |
| **cPanel** | https://panel.hostafrica.com | Hosting control panel |
| **Database (phpMyAdmin)** | cPanel → phpMyAdmin | For advanced/bulk operations |
| **Paystack dashboard** | https://dashboard.paystack.com | For live keys and refunds |
| **GitHub repo** | https://github.com/innio31/iavmn | Developer code repository |

---

## 7. Final Words

The website is live and working. Everything from membership applications to certificate downloads to newsletter sending is functional. You can now operate the site entirely from your admin dashboard.

**If something looks broken**, first check:
1. Are you logged in?
2. Did you refresh the page?
3. Is the internet connection working?

**If the site itself isn't loading at all**, the app may need a restart. Your developer or HostAfrica support can help.

**Welcome to the modern IAVMN.**

— Impact Digital Services