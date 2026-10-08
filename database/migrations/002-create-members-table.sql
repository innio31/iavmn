-- ============================================================
-- Migration 002: create the members table
-- Members are created automatically when an application is approved.
-- Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS `members` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `member_number`      VARCHAR(40) NOT NULL,
  `application_id`     INT UNSIGNED NULL,
  `tier_id`            INT UNSIGNED NOT NULL,
  `full_name`          VARCHAR(180) NOT NULL,
  `email`              VARCHAR(180) NOT NULL,
  `phone`              VARCHAR(40) NULL,
  `address`            VARCHAR(300) NULL,
  `employer`           VARCHAR(200) NULL,
  `qualifications`     TEXT NULL,
  `years_experience`   SMALLINT UNSIGNED NULL,
  `photo_path`         VARCHAR(255) NULL,

  -- Authentication
  `password_hash`      VARCHAR(255) NULL,
  `is_verified`        TINYINT(1) NOT NULL DEFAULT 0,
  `verified_at`        DATETIME NULL,
  `last_login_at`      DATETIME NULL,

  -- Password reset
  `reset_token`        VARCHAR(64) NULL,
  `reset_expires_at`   DATETIME NULL,

  -- Membership lifecycle
  `status`             ENUM('pending','active','suspended','expired','cancelled') NOT NULL DEFAULT 'pending',
  `joined_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`         DATETIME NULL,
  `notes`              TEXT NULL,

  -- Metadata
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_members_number` (`member_number`),
  UNIQUE KEY `uq_members_email` (`email`),
  KEY `idx_members_status` (`status`),
  KEY `idx_members_tier` (`tier_id`),
  KEY `idx_members_application` (`application_id`),
  CONSTRAINT `fk_members_tier` FOREIGN KEY (`tier_id`) REFERENCES `membership_tiers`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_members_application` FOREIGN KEY (`application_id`) REFERENCES `membership_applications`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add an index on the applications table so we can find approved apps without a member yet
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'membership_applications'
    AND INDEX_NAME = 'idx_app_status_payment'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_app_status_payment` ON `membership_applications` (`status`, `payment_status`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;