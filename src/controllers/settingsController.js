// src/controllers/settingsController.js
// Admin: view and edit site-wide settings.

import { validationResult } from 'express-validator';
import { getAllSettings, setManySettings } from '../models/settingsModel.js';
import { clearSettingsCache } from '../middleware/loadSettings.js';

// Groups of settings shown as separate tabs on the settings page.
// Order matters — fields render in this order.
const SETTING_GROUPS = [
  {
    key: 'general',
    label: 'General',
    fields: [
      { name: 'site_name',      label: 'Site name',          type: 'text' },
      { name: 'site_short_name',label: 'Short name',         type: 'text', hint: 'Used in the header when no logo is set.' },
      { name: 'site_tagline',   label: 'Tagline',            type: 'text' },
      { name: 'site_description', label: 'Description',      type: 'textarea' },
      { name: 'site_logo_path', label: 'Logo URL',           type: 'text', hint: 'e.g. /uploads/branding/logo.png' },
      { name: 'site_favicon_path', label: 'Favicon URL',     type: 'text' },
    ],
  },
  {
    key: 'contact',
    label: 'Contact',
    fields: [
      { name: 'contact_phone',     label: 'Primary phone',   type: 'text' },
      { name: 'contact_phone_alt', label: 'Alternate phone', type: 'text' },
      { name: 'contact_email',     label: 'Email',           type: 'email' },
      { name: 'contact_address',   label: 'Address',         type: 'text' },
      { name: 'contact_hours',     label: 'Office hours',    type: 'text' },
    ],
  },
  {
    key: 'social',
    label: 'Social',
    fields: [
      { name: 'social_facebook',  label: 'Facebook URL',  type: 'url' },
      { name: 'social_twitter',   label: 'X / Twitter URL', type: 'url' },
      { name: 'social_linkedin',  label: 'LinkedIn URL',  type: 'url' },
      { name: 'social_youtube',   label: 'YouTube URL',   type: 'url' },
      { name: 'social_instagram', label: 'Instagram URL', type: 'url' },
      { name: 'social_threads',   label: 'Threads URL',   type: 'url' },
    ],
  },
  {
    key: 'email',
    label: 'Email',
    fields: [
      { name: 'mail_from_name',       label: 'From name',    type: 'text' },
      { name: 'mail_from_email',      label: 'From email',   type: 'email' },
      { name: 'mail_admin_recipient', label: 'Admin recipient', type: 'email', hint: 'Where contact form and application notifications go.' },
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    fields: [
      { name: 'paystack_enabled', label: 'Paystack enabled (1/0)', type: 'text', hint: 'Set to 1 to enable payments.' },
      { name: 'currency',         label: 'Currency code',          type: 'text', hint: 'e.g. NGN' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics & SEO',
    fields: [
      { name: 'analytics_enabled',   label: 'Analytics enabled (1/0)',       type: 'text',  hint: 'Set to 1 to load the Google Analytics snippet on public pages.' },
      { name: 'analytics_ga4_id',    label: 'GA4 Measurement ID',            type: 'text',  hint: 'Looks like G-XXXXXXXXXX. Get it from analytics.google.com → Admin → Data Streams.' },
      { name: 'analytics_require_consent', label: 'Require cookie consent (1/0)', type: 'text', hint: 'If 1, GA4 will only load after the visitor accepts cookies.' },

      { name: 'seo_default_meta_description', label: 'Default meta description', type: 'textarea', hint: 'Fallback description used when a page does not have its own. 120–160 characters is ideal.' },
      { name: 'seo_default_og_image', label: 'Default share image URL',      type: 'text',  hint: 'Full URL or /uploads/... path. Recommended 1200×630 pixels.' },
      { name: 'seo_twitter_handle',  label: 'X / Twitter handle',            type: 'text',  hint: 'e.g. @iavmn — used in Twitter Card tags.' },

      { name: 'seo_organization_name',    label: 'Organization name',        type: 'text', hint: 'Used in Schema.org structured data.' },
      { name: 'seo_organization_logo',    label: 'Organization logo URL',    type: 'text', hint: 'Used in Schema.org structured data. Square or horizontal PNG.' },
      { name: 'seo_organization_country', label: 'Organization country',     type: 'text', hint: 'Two-letter ISO code, e.g. NG.' },
      { name: 'seo_organization_city',    label: 'Organization city',        type: 'text' },
    ],
  },
  {
    key: 'footer',
    label: 'Footer',
    fields: [
      { name: 'footer_copyright', label: 'Copyright line', type: 'text' },
      { name: 'footer_credits',   label: 'Credits line',   type: 'text' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    fields: [
      { name: 'maintenance_mode',    label: 'Maintenance mode (1/0)', type: 'text' },
      { name: 'dark_mode_default',   label: 'Dark mode default (1/0)', type: 'text' },
      { name: 'pwa_theme_color',     label: 'PWA theme color',         type: 'text', hint: 'Hex color, e.g. #25573f.' },
      { name: 'pwa_background_color',label: 'PWA background color',    type: 'text', hint: 'Hex color, e.g. #edf3f2.' },
    ],
  },
];

// All setting keys in one flat list — used for validation.
const ALL_KEYS = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.name));

// ─── GET /admin/settings ────────────────────────────────
export const showSettings = async (req, res) => {
  const settings = await getAllSettings();
  const activeTab = typeof req.query.tab === 'string' ? req.query.tab : SETTING_GROUPS[0].key;
  res.render('admin/settings', {
    title: 'Settings',
    layout: 'layouts/admin',
    settings,
    groups: SETTING_GROUPS,
    activeTab: SETTING_GROUPS.some((g) => g.key === activeTab) ? activeTab : SETTING_GROUPS[0].key,
  });
};

// ─── POST /admin/settings ───────────────────────────────
export const postSettings = async (req, res) => {
  // Build an object of only the keys we know about (ignore anything else).
  const updates = {};
  for (const key of ALL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[key] = String(req.body[key] ?? '').trim();
    }
  }

  // Normalize hex colors to lowercase, ensure they start with #
  ['pwa_theme_color', 'pwa_background_color'].forEach((key) => {
    if (updates[key]) {
      let v = updates[key].trim();
      if (!v.startsWith('#')) v = '#' + v;
      updates[key] = v.toLowerCase();
    }
  });

  // Normalize GA4 ID to uppercase (G-ABC123, not g-abc123)
  if (updates.analytics_ga4_id) {
    updates.analytics_ga4_id = updates.analytics_ga4_id.toUpperCase();
  }

  // Normalize twitter handle to always start with @
  if (updates.seo_twitter_handle) {
    let h = updates.seo_twitter_handle.trim();
    if (h && !h.startsWith('@')) h = '@' + h;
    updates.seo_twitter_handle = h;
  }

  await setManySettings(updates);
  clearSettingsCache();

  req.flash('success', 'Settings saved.');
  const tab = typeof req.body._tab === 'string' ? req.body._tab : '';
  res.redirect('/admin/settings' + (tab ? `?tab=${encodeURIComponent(tab)}` : ''));
};