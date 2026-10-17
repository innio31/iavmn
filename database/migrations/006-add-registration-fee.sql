-- ============================================================
-- Migration 006: separate registration_fee from fee_amount on tiers
--
-- Historically, tiers only had `fee_amount` (the membership fee).
-- Going forward, tiers have TWO fees:
--   - registration_fee: a fixed form/registration charge (usually the same for all tiers)
--   - fee_amount: the annual membership fee for that tier
--
-- The public application flow shows both, and charges the SUM.
--
-- Corporate (quote-based) tiers can use:
--   registration_fee = 0, fee_amount = 0 → app shows "Contact us for a quote"
--
-- Safe to re-run.
-- ============================================================

SET @db := DATABASE();

-- Add registration_fee column if it doesn't exist
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'membership_tiers'
    AND COLUMN_NAME = 'registration_fee'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `membership_tiers` ADD COLUMN `registration_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `fee_amount`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Set a sensible default for existing tiers: ₦20,000 registration fee
-- (matches the current IAVMN policy for all tiers that have a real fee)
UPDATE `membership_tiers`
SET `registration_fee` = 20000
WHERE `registration_fee` = 0
  AND `fee_amount` > 0;