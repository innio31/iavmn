-- ============================================================
-- IAVMN — Default settings seed
-- Run AFTER schema.sql. Safe to re-run (uses INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

INSERT INTO `settings` (`key`, `value`) VALUES
  ('site_name',              'Institute of Assets & Value Management Nigeria'),
  ('site_short_name',        'IAVMN'),
  ('site_tagline',           'Get certified and recognized as a professional.'),
  ('site_description',       'The Institute of Assets and Values Management of Nigeria (IAVMN) is a professional body dedicated to advancing the disciplines of asset management and related advisory services across Nigeria.'),
  ('site_logo_path',         '/uploads/branding/logo.png'),
  ('site_favicon_path',      '/uploads/branding/favicon.png'),

  ('contact_phone',          '+(234) 803 676 7461'),
  ('contact_phone_alt',      '+(234) 802 319 3478'),
  ('contact_email',          'info@iavmn.org'),
  ('contact_address',        'Lagos, Nigeria'),
  ('contact_hours',          'Mon – Fri, 9:00 AM – 5:00 PM'),

  ('social_facebook',        ''),
  ('social_twitter',         ''),
  ('social_linkedin',        ''),
  ('social_youtube',         ''),
  ('social_instagram',       ''),
  ('social_threads',         ''),

  ('footer_copyright',       'Institute of Asset And Value Management Nigeria'),
  ('footer_credits',         'Powered by Impact Digital'),

  ('mail_from_name',         'IAVMN'),
  ('mail_from_email',        'no-reply@iavmn.org'),
  ('mail_admin_recipient',   'info@iavmn.org'),

  ('paystack_enabled',       '1'),
  ('currency',               'NGN'),

  ('maintenance_mode',       '0'),
  ('dark_mode_default',      '0')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `updated_at` = CURRENT_TIMESTAMP;