-- ============================================================
-- IAVMN — Database Schema
-- MySQL 8 / MariaDB 10.4+
-- Run once in phpMyAdmin or via: mysql -u root impactdi_iavmn < database/schema.sql
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- users  (admin accounts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`           VARCHAR(120) NOT NULL,
  `email`          VARCHAR(180) NOT NULL,
  `password_hash`  VARCHAR(255) NOT NULL,
  `role`           ENUM('super_admin','admin','editor','membership_officer') NOT NULL DEFAULT 'editor',
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at`  DATETIME NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- settings  (site-wide key/value settings)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `key`         VARCHAR(80) NOT NULL,
  `value`       TEXT NULL,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- hero_slides  (homepage carousel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `hero_slides` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(200) NOT NULL,
  `subtitle`    VARCHAR(400) NULL,
  `image_path`  VARCHAR(255) NOT NULL,
  `cta_text`    VARCHAR(80) NULL,
  `cta_url`     VARCHAR(255) NULL,
  `sort_order`  INT NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hero_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- membership_tiers  (Student / Associate / Corporate / Fellow)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `membership_tiers` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`            VARCHAR(60) NOT NULL,
  `name`            VARCHAR(120) NOT NULL,
  `short_description` VARCHAR(255) NULL,
  `description`     TEXT NULL,
  `icon`            VARCHAR(80) NULL,
  `fee_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency`        VARCHAR(8) NOT NULL DEFAULT 'NGN',
  `sort_order`      INT NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tier_slug` (`slug`),
  KEY `idx_tier_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- council_members
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `council_members` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`          VARCHAR(160) NOT NULL,
  `full_name`     VARCHAR(180) NOT NULL,
  `job_title`     VARCHAR(180) NULL,
  `bio_short`     VARCHAR(400) NULL,
  `bio_full`      TEXT NULL,
  `photo_path`    VARCHAR(255) NULL,
  `email`         VARCHAR(180) NULL,
  `linkedin_url`  VARCHAR(255) NULL,
  `sort_order`    INT NOT NULL DEFAULT 0,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_council_slug` (`slug`),
  KEY `idx_council_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- pages  (About, Terms, Privacy, etc. — editable content)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pages` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`        VARCHAR(120) NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `content`     LONGTEXT NULL,
  `meta_title`  VARCHAR(200) NULL,
  `meta_description` VARCHAR(320) NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pages_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- faqs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faqs` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question`    VARCHAR(300) NOT NULL,
  `answer`      TEXT NOT NULL,
  `sort_order`  INT NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_faqs_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- testimonials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `testimonials` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `author_name` VARCHAR(120) NOT NULL,
  `author_title` VARCHAR(180) NULL,
  `author_photo_path` VARCHAR(255) NULL,
  `quote`       TEXT NOT NULL,
  `sort_order`  INT NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_testimonials_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- posts  (news / blog)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `posts` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`        VARCHAR(200) NOT NULL,
  `title`       VARCHAR(250) NOT NULL,
  `excerpt`     VARCHAR(400) NULL,
  `body`        LONGTEXT NULL,
  `cover_image_path` VARCHAR(255) NULL,
  `author_id`   INT UNSIGNED NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `published_at` DATETIME NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_posts_slug` (`slug`),
  KEY `idx_posts_published` (`is_published`, `published_at`),
  CONSTRAINT `fk_posts_author` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- membership_applications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `membership_applications` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference`          VARCHAR(40) NOT NULL,
  `tier_id`            INT UNSIGNED NOT NULL,
  `full_name`          VARCHAR(180) NOT NULL,
  `email`              VARCHAR(180) NOT NULL,
  `phone`              VARCHAR(40) NULL,
  `address`            VARCHAR(300) NULL,
  `employer`           VARCHAR(200) NULL,
  `qualifications`     TEXT NULL,
  `years_experience`   SMALLINT UNSIGNED NULL,
  `cv_path`            VARCHAR(255) NULL,
  `photo_path`         VARCHAR(255) NULL,
  `payment_status`     ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `payment_reference`  VARCHAR(120) NULL,
  `payment_amount`     DECIMAL(12,2) NULL,
  `payment_currency`   VARCHAR(8) NULL,
  `payment_paid_at`    DATETIME NULL,
  `status`             ENUM('submitted','under_review','approved','rejected') NOT NULL DEFAULT 'submitted',
  `admin_notes`        TEXT NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app_reference` (`reference`),
  KEY `idx_app_tier` (`tier_id`),
  KEY `idx_app_status` (`status`),
  KEY `idx_app_payment_status` (`payment_status`),
  CONSTRAINT `fk_app_tier` FOREIGN KEY (`tier_id`) REFERENCES `membership_tiers`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- subscribers  (newsletter)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscribers` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(180) NOT NULL,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `unsub_token`   VARCHAR(64) NOT NULL,
  `subscribed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscribers_email` (`email`),
  UNIQUE KEY `uq_subscribers_token` (`unsub_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- contact_messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(120) NOT NULL,
  `email`      VARCHAR(180) NOT NULL,
  `phone`      VARCHAR(40) NULL,
  `subject`    VARCHAR(200) NULL,
  `message`    TEXT NOT NULL,
  `is_read`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_read_created` (`is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- End of schema
-- ============================================================