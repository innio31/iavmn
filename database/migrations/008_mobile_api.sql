-- database/migrations/008_mobile_api.sql
-- Adds tables for the mobile API layer (Phase 1).
-- Safe to re-run: all statements use IF NOT EXISTS.

-- ─── refresh_tokens ─────────────────────────────────────
-- Stores hashed refresh tokens for JWT-based mobile auth.
-- Raw tokens are NEVER stored — only SHA-256 hashes.
-- Revocation is done by setting revoked_at (kept for audit).

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash` VARCHAR(255) NOT NULL,
  `user_type` ENUM('member','admin') NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_hash` (`token_hash`),
  KEY `idx_refresh_user` (`user_type`, `user_id`),
  KEY `idx_refresh_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── push_tokens ────────────────────────────────────────
-- Stores Expo push tokens per device per user.
-- One user can have many devices; one device maps to one user at a time.
-- UNIQUE on token allows "reassign on login" (device handed to a new user).

CREATE TABLE IF NOT EXISTS `push_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(255) NOT NULL,
  `user_type` ENUM('member','admin') NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `platform` ENUM('ios','android','web') NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_token` (`token`),
  KEY `idx_push_user` (`user_type`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;