-- ============================================
-- MIGRATION: Fight Engine Phase 2
-- Country codes, sport mode, mats, control board toggle
-- Run in Supabase SQL Editor
-- ============================================

-- 1) ATHLETE COUNTRY CODE
-- ============================================
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT NULL;

-- 2) TOURNAMENT SPORT MODE + CONTROL BOARD TOGGLE + MATS
-- ============================================
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS sport_mode TEXT NOT NULL DEFAULT 'BJJ',
  ADD COLUMN IF NOT EXISTS control_board_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mats_count INT NOT NULL DEFAULT 1;

-- Add check constraints
ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_sport_mode_check;
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_sport_mode_check
  CHECK (sport_mode IN ('BJJ','Grappling','MMA','Kickboxing','Muaythai','Boxing'));

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_mats_count_check;
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_mats_count_check
  CHECK (mats_count >= 1 AND mats_count <= 12);

-- 3) EVOLVE current_matches TO SUPPORT MAT-SCOPED STATE
-- ============================================
-- Drop old PK and add composite PK for tournament+mat
-- First check if mat_number column exists (from fight-engine migration)
-- The current_matches table has tournament_id as PK, we need to support
-- multiple rows per tournament (one per mat)

-- Step 1: Drop existing primary key
ALTER TABLE public.current_matches DROP CONSTRAINT IF EXISTS current_matches_pkey;

-- Step 2: Add composite primary key
ALTER TABLE public.current_matches ADD PRIMARY KEY (tournament_id, mat_number);

-- Step 3: Same for match_state — needs mat_number column
ALTER TABLE public.match_state
  ADD COLUMN IF NOT EXISTS mat_number INT NOT NULL DEFAULT 1;

ALTER TABLE public.match_state DROP CONSTRAINT IF EXISTS match_state_pkey;
ALTER TABLE public.match_state ADD PRIMARY KEY (tournament_id, mat_number);

-- 4) UPDATE RLS POLICIES FOR MAT-SCOPED TABLES
-- ============================================
-- Drop and recreate policies to handle new composite keys
-- (existing policies use tournament_id which still works via EXISTS)

-- current_matches policies already reference tournament_id, they still work
-- match_state policies already reference tournament_id, they still work
-- No changes needed to RLS — the EXISTS subqueries check tournament_id only

-- 5) INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_current_matches_tournament_mat
  ON public.current_matches(tournament_id, mat_number);
CREATE INDEX IF NOT EXISTS idx_match_state_tournament_mat
  ON public.match_state(tournament_id, mat_number);
