-- ============================================================
-- Migration 004: newsletter campaigns + per-recipient tracking
-- ============================================================

-- Campaigns table
CREATE TABLE IF NOT EXISTS `newsletter_sends` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subject`           VARCHAR(250) NOT NULL,
  `body_html`         LONGTEXT NOT NULL,
  `body_text`         LONGTEXT NULL,
  `created_by`        INT UNSIGNED NULL,
  `status`            ENUM('draft','sending','sent','failed','cancelled') NOT NULL DEFAULT 'draft',
  `total_recipients`  INT UNSIGNED NOT NULL DEFAULT 0,
  `sent_count`        INT UNSIGNED NOT NULL DEFAULT 0,
  `failed_count`      INT UNSIGNED NOT NULL DEFAULT 0,
  `started_at`        DATETIME NULL,
  `completed_at`      DATETIME NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_newsletter_status` (`status`),
  CONSTRAINT `fk_newsletter_user` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-recipient send log
CREATE TABLE IF NOT EXISTS `newsletter_recipients` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `send_id`        INT UNSIGNED NOT NULL,
  `subscriber_id`  INT UNSIGNED NULL,
  `email`          VARCHAR(180) NOT NULL,
  `status`         ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `error_message`  VARCHAR(500) NULL,
  `sent_at`        DATETIME NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recipients_send` (`send_id`),
  KEY `idx_recipients_status` (`status`),
  CONSTRAINT `fk_recipients_send` FOREIGN KEY (`send_id`) REFERENCES `newsletter_sends`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recipients_subscriber` FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;