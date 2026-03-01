-- ============================================
-- MIGRATION: Scoreboard – current_matches + match_state
-- Run this in Supabase SQL Editor
-- ============================================

-- 1) CURRENT MATCHES TABLE
-- One active match per tournament at a time
-- ============================================

CREATE TABLE public.current_matches (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  red_athlete_id UUID NOT NULL REFERENCES public.profiles(id),
  blue_athlete_id UUID NOT NULL REFERENCES public.profiles(id),
  red_registration_id UUID REFERENCES public.registrations(id),
  blue_registration_id UUID REFERENCES public.registrations(id),
  status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','RUNNING','FINISHED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) MATCH STATE TABLE
-- Stores all scoreboard state for realtime sync
-- ============================================

CREATE TABLE public.match_state (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL DEFAULT 1,
  match_seconds INT NOT NULL DEFAULT 300,
  timer_running BOOLEAN NOT NULL DEFAULT false,
  red_score INT NOT NULL DEFAULT 0,
  blue_score INT NOT NULL DEFAULT 0,
  red_adv INT NOT NULL DEFAULT 0,
  blue_adv INT NOT NULL DEFAULT 0,
  red_pen INT NOT NULL DEFAULT 0,
  blue_pen INT NOT NULL DEFAULT 0,
  red_kd INT NOT NULL DEFAULT 0,
  blue_kd INT NOT NULL DEFAULT 0,
  show_adv_pen BOOLEAN NOT NULL DEFAULT true,
  red_stalling_seconds INT NOT NULL DEFAULT 0,
  blue_stalling_seconds INT NOT NULL DEFAULT 0,
  stalling_running TEXT DEFAULT NULL CHECK (stalling_running IN ('red','blue',NULL)),
  winner_side TEXT DEFAULT NULL CHECK (winner_side IN ('red','blue',NULL)),
  win_method TEXT DEFAULT NULL,
  winner_overlay_visible BOOLEAN NOT NULL DEFAULT false,
  sport_mode TEXT NOT NULL DEFAULT 'BJJ',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) AUTO-UPDATE updated_at TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_current_matches_updated
  BEFORE UPDATE ON public.current_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_match_state_updated
  BEFORE UPDATE ON public.match_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.current_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_state ENABLE ROW LEVEL SECURITY;

-- current_matches: organizer can manage; anyone with tournament access can read
CREATE POLICY "Organizer can manage current_matches"
  ON public.current_matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = current_matches.tournament_id
      AND t.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = current_matches.tournament_id
      AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read current_matches for visible tournaments"
  ON public.current_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = current_matches.tournament_id
      AND t.status IN ('OPEN','LIVE')
    )
  );

-- match_state: organizer can manage; anyone with tournament access can read
CREATE POLICY "Organizer can manage match_state"
  ON public.match_state FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = match_state.tournament_id
      AND t.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = match_state.tournament_id
      AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read match_state for visible tournaments"
  ON public.match_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = match_state.tournament_id
      AND t.status IN ('OPEN','LIVE')
    )
  );

-- 5) Allow profiles to be read for display board athletes
-- Already covered by existing "Organizers can view registered athlete base profiles"
-- and we need a public read for display board:
CREATE POLICY "Anyone can read profiles for current matches"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.current_matches cm
      WHERE cm.red_athlete_id = profiles.id
         OR cm.blue_athlete_id = profiles.id
    )
  );

-- Allow athlete_profiles to be read for display board
CREATE POLICY "Anyone can read athlete profiles for current matches"
  ON public.athlete_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.current_matches cm
      WHERE cm.red_athlete_id = athlete_profiles.id
         OR cm.blue_athlete_id = athlete_profiles.id
    )
  );

-- 6) ENABLE REALTIME
-- ============================================
-- Run these in SQL Editor to enable realtime on the tables:

ALTER PUBLICATION supabase_realtime ADD TABLE public.current_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_state;
