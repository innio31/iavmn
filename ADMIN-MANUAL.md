# IAVMN — Administrator Manual

**For:** Institute of Assets & Value Management Nigeria (IAVMN) management
**From:** Impact Digital — Academy & Services
**Date:** October 2026
**Version:** 2.0
**Website:** https://iavmn.org.ng

---

## 1. Overview

Your website is now a **full Content Management System (CMS)** — everything you see on the public site can be managed by your team from a secure admin dashboard. No coding knowledge required.

This manual covers:

1. **What has been delivered** (ready to use)
2. **How to log in and navigate**
3. **Each admin section explained**
4. **Daily operations** (approving members, responding to messages)
5. **Email & payment systems**
6. **Security and best practices**

---

## 2. What Has Been Delivered

### 2.1 Public Website

| Feature | Status | Notes |
|---|---|---|
| Home page with hero carousel | ✅ | Fully dynamic |
| About Us section | ✅ | Content from Settings |
| Membership tiers | ✅ | Cards with fees and icons |
| Online membership application | ✅ | With CV + photo upload |
| Paystack payment integration | ✅ | Live-ready once keys added |
| Member portal | ✅ | Login, profile, certificate, payments |
| Certificate PDF with QR code | ✅ | Auto-generated per member |
| Public member verification page | ✅ | `/verify` — anyone can check |
| Council members listing and profiles | ✅ | Photo, bio, contact |
| News & Updates (blog) | ✅ | Paginated, shareable |
| Individual news article pages | ✅ | With social share buttons |
| FAQ accordion | ✅ | Expandable Q&A |
| Contact form | ✅ | Notifies admin + auto-replies |
| Newsletter subscribe | ✅ | Welcome email + unsubscribe |
| Editable pages | ✅ | About, Privacy, Terms, Vision, etc. |
| Custom navigation menu | ✅ | Mark pages "show in menu" |
| Site-wide search | ✅ | News, pages, FAQs, council, tiers |
| Mobile responsive | ✅ | Works on all devices |
| SEO-ready | ✅ | Meta tags, Open Graph, sitemap |
| Installable as mobile app | ✅ | PWA — adds to home screen |

### 2.2 Admin Dashboard

At `/admin` — manage everything below without any coding:

- **Dashboard** — live stats, recent activity, quick actions
- **Settings** — site name, contact, socials, email, payments, analytics, SEO, footer
- **Hero Slides** — homepage carousel with image upload
- **Membership Tiers** — name, fee, currency, icon, description, publish status
- **Council Members** — profiles with photo, bio, LinkedIn, email
- **Pages** — content pages with optional "show in menu" toggle
- **FAQs** — questions and answers, sortable
- **Testimonials** — member quotes with optional author photo
- **Posts** — news/blog with cover image, excerpt, publish scheduling
- **Applications** — review, approve/reject, view CVs and photos
- **Members** — full member management with status, tier, expiry, password
- **Newsletter** — compose and send campaigns to all subscribers
- **Subscribers** — newsletter list with CSV export
- **Contact Messages** — inbox with read/unread, reply-by-email
- **Admin Users** — multi-user with role-based access

### 2.3 Automated Features

| Event | What Happens |
|---|---|
| Visitor submits contact form | Admin notified + sender gets acknowledgement |
| Visitor subscribes to newsletter | Welcome email with unsubscribe link |
| Applicant submits membership form | Admin notified + applicant gets confirmation |
| Applicant pays | Admin notified + applicant gets receipt |
| Admin approves application | Member account created + welcome email with set-password link |
| Admin rejects application | Applicant gets rejection email with your note |
| Member logs in and downloads certificate | PDF with embedded QR code |
| Anyone scans the QR code | Opens a public verification page |

### 2.4 Real-Time Notifications

When you're on any admin page:

- **Green "Live" pill** appears in the top bar — real-time notifications are active
- New activity triggers a **toast notification** in the bottom-right within ~15 seconds
- **Sidebar badge counts** update live (Contact Messages, Applications)
- No need to refresh the page

---

## 3. Getting Started

### 3.1 First-time setup checklist

If your site is brand new, do these in order:

1. **Log in** at https://iavmn.org.ng/login
2. **Settings → General** — set the real site name, tagline, description
3. **Settings → Contact** — real phone, email, address, hours
4. **Settings → Social** — add your Facebook, X, LinkedIn, YouTube, Instagram URLs
5. **Settings → Email** — verify the admin recipient (usually `info@iavmn.org.ng`)
6. **Settings → Payment** — verify `paystack_enabled = 1`, `currency = NGN`
7. **Settings → Footer** — set copyright and credits lines
8. **Branding** — confirm the logo and favicon appear correctly

### 3.2 Uploading your logo

If your logo isn't showing correctly:

1. Prepare a PNG or SVG file (transparent background, ~50-100px tall)
2. Upload via cPanel File Manager to `public/uploads/branding/logo.png`
3. In admin → Settings → General, set **Logo URL** to `/uploads/branding/logo.png`
4. Save

For favicon, same process with `/uploads/branding/favicon.ico`.

### 3.3 Building your content

Suggested order:

1. **Membership Tiers** — Student, Associate, Corporate, Fellow with correct fees
2. **Hero Slides** — 2-3 slides for the homepage carousel
3. **Council Members** — each member with photo and biography
4. **Pages** — review About, add Privacy Policy and Terms
5. **FAQs** — at least 5 common questions
6. **Testimonials** — quotes from existing members
7. **Posts** — welcome announcement, upcoming events

---

## 4. Navigating the Admin

### 4.1 The dashboard

When you log in, you land on the **Dashboard**, which shows:

- **Stat tiles** — unread messages, applications awaiting review, paid applications, subscribers
- **Recent activity** — the last 5 messages and last 5 applications
- **Quick actions** — buttons to write a post, add a tier, add council member, etc.

The tiles are **clickable** — click any count to jump to that filtered list.

### 4.2 The sidebar

The left sidebar is your main navigation:

- **Dashboard** — the home of admin
- **Settings** — global site configuration
- **Hero Slides** — homepage carousel
- **Membership Tiers** — membership categories
- **Council Members** — governing council profiles
- **Pages** — About, Privacy, custom pages
- **FAQs** — frequently asked questions
- **Testimonials** — member quotes
- **Posts** — news and blog articles
- **Applications** — submitted membership applications
- **Members** — approved members
- **Subscribers** — newsletter list
- **Newsletter** — send campaigns
- **Contact Messages** — form submissions
- **Admin Users** — other admin accounts (super admins only)

**Badges** appear next to items that need attention:
- **Contact Messages** — count of unread messages
- **Applications** — count of applications awaiting review

### 4.3 Mobile use

On phones and tablets:
- Tap the **☰ hamburger icon** to open the sidebar
- Tap outside the sidebar to close it
- All tables become **stacked cards**

### 4.4 Real-time notifications

The **green "Live" pill** appears in the top bar. When new activity happens:
- A **toast** slides in from the bottom-right
- Tap **View →** on the toast to jump to the item
- Toast auto-dismisses after 8 seconds
- Click the × to dismiss early

If the pill turns **amber** or **red**, the connection to the server is interrupted — the system auto-retries within 15 seconds.

---

## 5. Daily Operations

### 5.1 Contact messages

When a visitor submits the contact form:

1. You'll see a **toast** in the admin dashboard (if you're logged in)
2. The admin inbox (`info@iavmn.org.ng`) receives an email
3. The visitor receives an auto-acknowledgement

**To respond**:
1. Click **Contact Messages** in the sidebar
2. Click **Read** on a message
3. It marks as **read** automatically
4. Click **Reply by Email** to open your mail client

**To mark all as read**: click the "Mark all as read" button at the top

### 5.2 Membership applications

When an applicant submits the form:

1. Application appears in `/admin/applications` with status **Submitted**
2. If they paid: payment badge shows **Paid**
3. If they haven't paid yet: badge shows **Pending**

**To review**:
1. Filter by status: **Submitted**, **Under review**, **Approved**, **Rejected**
2. Filter by payment: **Pending**, **Paid**
3. Click **View** on an application
4. Review the applicant's details, click **Open CV** or **View photo**
5. Update **status** and add **admin notes**
6. Click **Save Changes**

**Status workflow**:
```
Submitted → Under Review → Approved / Rejected
```

**When you Approve**:
- A **member account** is automatically created
- A unique **member number** is generated (e.g., `IAVMN/MEM/2026/0001`)
- A **welcome email** is sent to the applicant with a **Set My Password** link
- The member can then access the member portal

**When you Reject**:
- A **decision email** is sent to the applicant with your admin note
- The applicant can reapply in the future

### 5.3 Managing members

Members are approved applicants. Each member has:
- A **member number** (permanent, unique)
- A **tier** (can be changed by admin)
- A **status** — Active, Pending, Suspended, Expired, Cancelled
- An **expiry date** (12 months after approval by default)
- A **public verification page** at `/verify/<member_number>`

**To manage a member**:
1. Go to **Members** in the sidebar
2. Click **View** on any member
3. On the detail page you can:
   - Change their **tier**
   - Change their **status** (Active / Suspended / Expired)
   - Adjust their **expiry date**
   - Send a **password reset link** to their email
   - **Set a password directly** (for troubleshooting)
   - **Delete** the member (permanent)
   - View their **original application**

**Quick status changes** are available via buttons: Activate, Suspend, Mark expired.

**Note**: Members can **edit their own** name, phone, address, employer, and qualifications via the member portal. Only admins can change tier, status, and expiry.

### 5.4 News and posts

1. Go to **Posts** in the sidebar
2. Click **+ New Post**
3. Fill in:
   - **Title** — headline
   - **Slug** — auto-generated (editable)
   - **Excerpt** — 1-2 sentence summary
   - **Body** — full article (blank lines create paragraphs; short lines become subheadings)
   - **Cover image** — 16:9, e.g., 1600×900
   - **Published** checkbox
   - **Publish date** — leave as-is for now, or schedule for later
4. Click **Create Post**

Posts appear at `/news`, and the latest 3 show on the homepage.

### 5.5 Newsletter

1. Go to **Newsletter** in the sidebar
2. Click **+ Compose Newsletter**
3. Fill in **Subject** and **Body** (rich-text editor with formatting toolbar)
4. **Test first** — use the "Send a test" panel to email yourself a copy
5. Click **Send to N Subscribers** to send to everyone

**Progress tracking**: after sending, you land on the campaign detail page showing:
- Total recipients
- Sent / Failed / Pending counts
- Progress bar
- Per-recipient log

**Rate limit**: emails send in batches of 20 with a short delay between batches.

**Unsubscribe**: every newsletter includes an automatic unsubscribe link.

### 5.6 Contact messages and CSV export

**Subscribers** can be exported:
1. Go to **Subscribers**
2. Click **Export CSV**
3. You'll download a file with `email,subscribed_at` columns
4. Use with Mailchimp, Zoho Campaigns, or your own mail client for external campaigns

### 5.7 Editing pages

Pages are for content that isn't a blog post or a tier — e.g., **About**, **Privacy Policy**, **Terms**, **Vision & Mission**.

1. Go to **Pages**
2. Click **+ New Page**
3. Fill in:
   - **Title** — page heading
   - **Slug** — URL (auto-generated, or custom)
   - **Content** — page body (blank lines = paragraphs, short lines = subheadings)
   - **Meta title** — for SEO (optional)
   - **Meta description** — for SEO (optional)
   - **Show in menu** — if checked, appears in the main navigation
   - **Published**
4. Click **Create Page**

**Reserved URLs**: some slugs (`/about`, `/contact`, `/membership`, `/faq`, `/council-members`) are reserved — you can edit their content, but not their URL.

### 5.8 Site-wide search

The site has a search icon in the header (🔍). Visitors can:
- Click the icon to open a full-screen search overlay
- Type 2+ characters to see live suggestions
- Press Enter for full results

Search covers: **News**, **Pages**, **FAQs**, **Council members**, **Membership tiers**.

---

## 6. Payments — How Paystack Works

### 6.1 Where money goes

Paystack deposits payments into your organisation's bank account. Setup requires:
- A verified Paystack account (business documents + bank account)
- Settlement schedule (usually T+1 — next business day)

### 6.2 Fees

Paystack charges:
- **1.5% + ₦100** for local Nigerian cards (capped at ₦2,000)
- **3.9% + ₦100** for international cards

Paystack deducts fees before settlement.

### 6.3 Test mode vs Live mode

Paystack accounts start in **Test mode**:
- No real money moves
- Test cards provided by Paystack (e.g., `4084 0840 8408 4081`)

When you're ready for live payments, your developer will swap the API keys to Live mode. The app auto-detects this — the mock checkout page disappears and real payments begin.

### 6.4 Refunds

Refunds are done in the **Paystack dashboard**, not this website. Once refunded, ask your developer to update the application's payment status in the database (this admin UI feature may come in a future update).

### 6.5 Where to find Paystack keys

1. Log in to https://dashboard.paystack.com
2. Go to **Settings → API Keys & Webhooks**
3. Provide the Live keys to your developer

### 6.6 Webhook URL

Set the webhook URL in Paystack to:

```
https://iavmn.org.ng/webhooks/paystack
```

This lets Paystack notify the site server-side when a payment succeeds — even if the customer closes the browser mid-transaction.

---

## 7. Email — How It Works

### 7.1 Emails sent by the system

Every action that should notify someone sends an email:

| Event | Recipient |
|---|---|
| Contact form submitted | Admin + auto-reply to sender |
| Newsletter subscribe | Welcome email to subscriber |
| New application | Admin + applicant |
| Payment success | Admin + applicant (receipt) |
| Application approved | Applicant (welcome + set password link) |
| Application rejected | Applicant (with admin note) |
| Password reset (admin or member) | The user requesting it |
| Newsletter campaign | All active subscribers |

### 7.2 Email deliverability

To avoid emails landing in spam, SPF and DKIM records should be set up for `iavmn.org.ng`. Your developer is handling this — status pending with HostAfrica.

**Until then**: some emails may occasionally land in spam. Ask new members to check their spam folder if they say they didn't receive a welcome email.

### 7.3 From address

Currently emails send from `info@iavmn.org.ng` (or whatever your developer configured). To change this:
- Create the new email account in cPanel → Email Accounts
- Provide the credentials to your developer

---

## 8. Backups

### 8.1 What needs backing up

Two things:
1. **The database** — all content, applications, subscribers, messages
2. **Uploaded files** — logos, photos, CVs, cover images

### 8.2 Automatic backups

Your developer has set up (or should set up) daily cron jobs on the server:
- Database export at 3:00 AM daily
- Uploads folder tarball at 3:30 AM daily
- Both stored in `~/backups/` on the server

### 8.3 Off-site backups

**Recommended:** Download the weekly backup zip from cPanel → **Backup Wizard** to your computer or cloud storage. This protects against server failure.

### 8.4 Restoring from backup

Restoration requires technical assistance. If something breaks:
1. Contact your developer
2. Provide the most recent backup file

---

## 9. Security Best Practices

### 9.1 Passwords

- **Admin passwords** should be 12+ characters, mixed case, numbers, symbols
- **Never share** admin credentials over WhatsApp, email, or SMS
- Use a password manager (Bitwarden, 1Password, or similar)
- Change passwords if any staff member leaves

### 9.2 Sessions

- Sessions expire after **24 hours** of inactivity
- Always **Log Out** when done on a shared computer
- Do not use the admin area on public Wi-Fi without HTTPS

### 9.3 Roles

Assign the **minimum role** needed:
- **Editor** — for staff who only update content
- **Membership Officer** — for staff who only review applications
- **Admin** — for senior staff (everything except user management)
- **Super Admin** — only for the director/CEO and one IT lead

### 9.4 Uploads

- Only upload files from trusted sources
- Do not upload executable files
- Max file size: **5 MB**
- Allowed types: JPG, PNG, WEBP, GIF, PDF, DOC, DOCX

### 9.5 Reporting security issues

If you suspect the site has been compromised:
1. Immediately change the admin password
2. Contact your developer
3. Check the Paystack dashboard for unauthorized transactions
4. Review recent applications and messages for suspicious activity

---

## 10. Common Tasks Quick Reference

| Task | Where |
|---|---|
| Change site name | Settings → General |
| Update phone/email | Settings → Contact |
| Add hero slide | Hero Slides → New |
| Add council member | Council Members → New |
| Create FAQ | FAQs → New |
| Write a news post | Posts → New |
| Update About page | Pages → Edit About |
| Review an application | Applications → View |
| Approve an applicant | Application view → set status Approved |
| Reset a member's password | Members → View → Send reset link |
| Reply to a message | Contact Messages → Read → Reply |
| Export subscribers | Subscribers → Export CSV |
| Send a newsletter | Newsletter → Compose |
| View a member's certificate | Members → View → Public verification page |
| Change Paystack keys | Contact developer (env file) |
| Change email config | Contact developer (env file) |
| Reset admin password | Login page → Forgot password |

---

## 11. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Cannot log in | Wrong password | Click "Forgot your password?" on the login page |
| Emails not arriving | Spam folder, or SPF/DKIM pending | Check spam; contact developer |
| Payment fails | Wrong Paystack keys, or test card in live mode | Verify keys; use correct card |
| Images not showing | Upload failed, or file deleted | Re-upload; check file size |
| Real-time pill says "Connecting" | Network issue | Wait 15 seconds; refresh page |
| Toast notifications stop | Network interruption | Refresh the admin page |
| "Server error" page | Application crashed | Contact developer |
| Slow site | Shared hosting load | Contact HostAfrica support |

---

## 12. What to Do If Something Breaks

1. **Don't panic.** The site is designed to keep serving content even if emails or payments fail.
2. **Note what you were doing** when it happened.
3. **Take a screenshot** if possible.
4. **Contact your developer** with:
   - What you were trying to do
   - What happened (error message, screenshot)
   - The approximate time
5. **Do not** attempt database changes without guidance.

For urgent issues (payment not working, site down), also notify HostAfrica support.

---

## 13. Contacts

**Development & Technical Support:**
Emmanuel — Impact Digital (Academy & Services)
https://impactdigitalacademy.com.ng

**Hosting Provider:**
HostAfrica — https://hostafrica.com/support

**Payment Processor:**
Paystack — https://paystack.com/support

**Email (SMTP):**
Handled by HostAfrica cPanel

---

## 14. Recommended Next Steps

**Immediate (before launch):**

1. Complete initial settings (Section 3.1)
2. Upload real logo, favicon, hero slides
3. Create membership tiers with correct fees
4. Add council members with photos and bios
5. Add FAQs and testimonials
6. Test the full application + payment flow end-to-end
7. Wait for SPF/DKIM confirmation from developer

**Within 30 days:**

1. Set up Google Analytics (Settings → Analytics & SEO → GA4 ID)
2. Add the site to Google Search Console
3. Send your first real newsletter
4. Test one live payment (₦100 to yourself, refund after)

**Within 3 months:**

1. Consider automated member renewal reminders
2. Consider public event galleries
3. Consider SMS notifications for applications

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Admin Dashboard** | The private management area at `/admin` |
| **CMS** | Content Management System |
| **Member Portal** | Private area for approved members at `/member` |
| **Tier** | A membership category (Student, Associate, etc.) |
| **Application** | A submitted request for membership |
| **Member** | An approved applicant with portal access |
| **SMTP** | Standard for sending email |
| **Paystack** | Payment processor (cards, bank, USSD) |
| **Webhook** | Automatic notification from one system to another |
| **PWA** | Progressive Web App — installable website |
| **QR Code** | Square barcode — used on certificates for verification |
| **Session** | Logged-in state that lasts until logout or expiry |
| **Slug** | URL-friendly version of a title |
| **SEO** | Search Engine Optimization |
| **SPF/DKIM** | DNS records that improve email deliverability |

---

**End of Manual**

*Questions about anything in this document? Contact Impact Digital Services.*