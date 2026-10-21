-- ============================================================
-- Migration 007: Global registration form fee
-- ============================================================

INSERT INTO `settings` (`key`, `value`) VALUES
  ('registration_form_fee', '20000')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `updated_at` = CURRENT_TIMESTAMP;