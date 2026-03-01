-- ============================================
-- MIGRATION: Fight Engine — evolve to fights table
-- Run this in Supabase SQL Editor AFTER the scoreboard migration
-- ============================================

-- 1) EVOLVE current_matches → fights (future-safe: supports history + multi-mat)
-- ============================================

-- Add new columns to current_matches for fight engine
ALTER TABLE public.current_matches
  ADD COLUMN IF NOT EXISTS fight_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS mat_number INT NOT NULL DEFAULT 1;

-- Expand status to include new fight states
ALTER TABLE public.current_matches DROP CONSTRAINT IF EXISTS current_matches_status_check;
ALTER TABLE public.current_matches
  ADD CONSTRAINT current_matches_status_check
  CHECK (status IN ('idle','confirmed','live','finished','READY','RUNNING','FINISHED'));

-- Update existing rows to new status values
UPDATE public.current_matches SET status = 'confirmed' WHERE status = 'READY';
UPDATE public.current_matches SET status = 'live' WHERE status = 'RUNNING';
UPDATE public.current_matches SET status = 'finished' WHERE status = 'FINISHED';

-- Make red/blue athlete nullable (for idle state)
ALTER TABLE public.current_matches ALTER COLUMN red_athlete_id DROP NOT NULL;
ALTER TABLE public.current_matches ALTER COLUMN blue_athlete_id DROP NOT NULL;

-- 2) FIGHT HISTORY TABLE (for future expansion)
-- ============================================

CREATE TABLE IF NOT EXISTS public.fight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  mat_number INT NOT NULL DEFAULT 1,
  red_athlete_id UUID REFERENCES public.profiles(id),
  blue_athlete_id UUID REFERENCES public.profiles(id),
  red_score INT NOT NULL DEFAULT 0,
  blue_score INT NOT NULL DEFAULT 0,
  red_adv INT NOT NULL DEFAULT 0,
  blue_adv INT NOT NULL DEFAULT 0,
  red_pen INT NOT NULL DEFAULT 0,
  blue_pen INT NOT NULL DEFAULT 0,
  winner_side TEXT CHECK (winner_side IN ('red','blue',NULL)),
  win_method TEXT,
  sport_mode TEXT NOT NULL DEFAULT 'BJJ',
  duration_seconds INT,
  status TEXT NOT NULL DEFAULT 'finished',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for fight_history
ALTER TABLE public.fight_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizer can manage fight_history"
  ON public.fight_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = fight_history.tournament_id
      AND t.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = fight_history.tournament_id
      AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read fight_history for visible tournaments"
  ON public.fight_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = fight_history.tournament_id
      AND t.status IN ('OPEN','LIVE')
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fight_history_tournament ON public.fight_history(tournament_id);
CREATE INDEX IF NOT EXISTS idx_fight_history_tournament_mat ON public.fight_history(tournament_id, mat_number);
