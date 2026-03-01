-- ============================================
-- MIGRATION: Tournament Lifecycle + Slug + Private + Deadline + Capacity
-- Run this in Supabase SQL Editor
-- ============================================

-- 1) Replace the old tournament_status enum with new lifecycle phases
-- We need to: create new enum, add temp column, migrate data, drop old, rename

-- Create the new enum
CREATE TYPE public.tournament_status_v2 AS ENUM ('DRAFT', 'OPEN', 'LIVE', 'ARCHIVED');

-- Add a temp column with the new enum
ALTER TABLE public.tournaments ADD COLUMN status_new public.tournament_status_v2;

-- Migrate existing data: OPEN stays OPEN, CLOSED → ARCHIVED
UPDATE public.tournaments SET status_new = 'OPEN' WHERE status = 'OPEN';
UPDATE public.tournaments SET status_new = 'ARCHIVED' WHERE status = 'CLOSED';
UPDATE public.tournaments SET status_new = 'DRAFT' WHERE status_new IS NULL;

-- Make not-null
ALTER TABLE public.tournaments ALTER COLUMN status_new SET NOT NULL;
ALTER TABLE public.tournaments ALTER COLUMN status_new SET DEFAULT 'DRAFT';

-- Drop old column and rename
ALTER TABLE public.tournaments DROP COLUMN status;
ALTER TABLE public.tournaments RENAME COLUMN status_new TO status;

-- Drop old enum type (safe now)
DROP TYPE public.tournament_status;

-- Rename new enum for cleanliness
ALTER TYPE public.tournament_status_v2 RENAME TO tournament_status;

-- 2) Add slug column (unique, for friendly URLs)
ALTER TABLE public.tournaments ADD COLUMN slug TEXT UNIQUE;

-- Generate slugs for existing tournaments
UPDATE public.tournaments
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
) || '-' || LEFT(id::text, 8)
WHERE slug IS NULL;

-- Make slug not-null after backfill
ALTER TABLE public.tournaments ALTER COLUMN slug SET NOT NULL;

-- 3) Add is_private (default false)
ALTER TABLE public.tournaments ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;

-- 4) Add registration_closes_at (nullable timestamp)
ALTER TABLE public.tournaments ADD COLUMN registration_closes_at TIMESTAMPTZ DEFAULT NULL;

-- 5) Rename max_participants → capacity for clarity (keeping backward compat)
-- Actually, let's keep max_participants as-is and just use it as capacity to avoid breaking changes.
-- The column already exists. No change needed.

-- 6) Create index on slug for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_slug ON public.tournaments(slug);

-- 7) Update RLS policies for the new status values
-- Drop and recreate the public read policy to include OPEN and LIVE
DROP POLICY IF EXISTS "Anyone can read OPEN tournaments" ON public.tournaments;

CREATE POLICY "Public can read visible tournaments"
  ON public.tournaments FOR SELECT
  USING (
    -- Organizer can always see their own
    organizer_id = auth.uid()
    -- Public can see OPEN/LIVE that are not private
    OR (status IN ('OPEN', 'LIVE') AND is_private = false)
    -- Anyone with direct link can see OPEN/LIVE (even private) - handled in app code by allowing select on id/slug
    OR (status IN ('OPEN', 'LIVE'))
  );

-- Note: The above allows all OPEN/LIVE to be SELECTed (for direct-link access).
-- The is_private filter is enforced in application queries for listing pages.
-- This is intentional: private tournaments are accessible by direct link but not listed.
