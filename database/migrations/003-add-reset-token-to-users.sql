-- ============================================================
-- Migration 003: add password reset token columns to `users`
-- Safe to re-run (checks for column existence before adding).
-- ============================================================

SET @db := DATABASE();

-- reset_token
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'reset_token'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `reset_token` VARCHAR(64) NULL AFTER `last_login_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reset_expires_at
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'reset_expires_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `reset_expires_at` DATETIME NULL AFTER `reset_token`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for fast lookup by token (only if not already present)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_reset_token'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_users_reset_token` ON `users` (`reset_token`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;