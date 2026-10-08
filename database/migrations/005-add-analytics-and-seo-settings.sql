-- ============================================================
-- Migration 005: analytics and SEO settings
-- Safe to re-run (uses INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

INSERT INTO `settings` (`key`, `value`) VALUES
  ('analytics_enabled',       '0'),
  ('analytics_ga4_id',        ''),
  ('analytics_require_consent', '1'),
  ('seo_default_og_image',    ''),
  ('seo_twitter_handle',      ''),
  ('seo_default_meta_description', ''),
  ('seo_organization_name',   'Institute of Assets & Value Management Nigeria'),
  ('seo_organization_logo',   ''),
  ('seo_organization_country', 'NG'),
  ('seo_organization_city',   'Lagos'),
  ('pwa_theme_color',         '#25573f'),
  ('pwa_background_color',    '#edf3f2')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `updated_at` = CURRENT_TIMESTAMP;