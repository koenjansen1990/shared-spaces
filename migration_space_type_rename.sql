-- Rename space_type enum values from workplace/holiday_home → weekly/monthly
-- Run this against your Supabase project via the SQL editor.

-- PostgreSQL doesn't support ALTER TYPE ... RENAME VALUE before v14.
-- We use the supported workaround: rename old values, add new ones, migrate data.

-- 1. Add new enum values
ALTER TYPE space_type ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE space_type ADD VALUE IF NOT EXISTS 'monthly';

-- 2. Migrate existing rows
UPDATE spaces SET space_type = 'weekly'  WHERE space_type = 'workplace';
UPDATE spaces SET space_type = 'monthly' WHERE space_type = 'holiday_home';

-- NOTE: PostgreSQL does not allow removing enum values once added.
-- The old 'workplace' and 'holiday_home' values remain in the enum but are
-- no longer used by the application. If you need a clean enum, recreate it:
--
--   CREATE TYPE space_type_new AS ENUM ('weekly', 'monthly');
--   ALTER TABLE spaces ALTER COLUMN space_type TYPE space_type_new
--     USING space_type::text::space_type_new;
--   DROP TYPE space_type;
--   ALTER TYPE space_type_new RENAME TO space_type;
