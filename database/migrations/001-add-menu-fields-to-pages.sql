-- ============================================================
-- Migration 001: add menu-related fields to `pages`
-- Safe to re-run: checks for column existence.
-- ============================================================

SET @db := DATABASE();

-- show_in_menu
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pages'
    AND COLUMN_NAME = 'show_in_menu'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `pages` ADD COLUMN `show_in_menu` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_published`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- menu_label
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pages'
    AND COLUMN_NAME = 'menu_label'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `pages` ADD COLUMN `menu_label` VARCHAR(60) NULL AFTER `show_in_menu`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- menu_order
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pages'
    AND COLUMN_NAME = 'menu_order'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `pages` ADD COLUMN `menu_order` INT NOT NULL DEFAULT 0 AFTER `menu_label`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- index for fast menu lookup
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pages'
    AND INDEX_NAME = 'idx_pages_menu'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_pages_menu` ON `pages` (`is_published`, `show_in_menu`, `menu_order`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;