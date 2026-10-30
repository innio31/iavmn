-- ============================================================
-- Migration 008: certificate signature settings
-- Adds:
--   - cert_signature_registrar_path   (Registrar's signature image)
--   - cert_signature_president_path   (President's signature image)
--   - cert_registrar_name             (text under registrar signature)
--   - cert_president_name             (text under president signature)
--   - cert_registrar_title            (title under registrar signature)
--   - cert_president_title            (title under president signature)
--
-- Safe to re-run.
-- ============================================================

INSERT INTO `settings` (`key`, `value`) VALUES
  ('cert_signature_registrar_path', ''),
  ('cert_signature_president_path', ''),
  ('cert_registrar_name',           'Prof. Babatunde Akinsanya, PhD, FCA, FCMA, FNIMN, FIAVM'),
  ('cert_registrar_title',          'Registrar / Chief Executive'),
  ('cert_president_name',           'Prof. Kolawole Subair, PhD, FIAVM'),
  ('cert_president_title',          'President / Chairman of Governing Council')
ON DUPLICATE KEY UPDATE
  `value` = `value`;