-- ============================================
-- TOURNAMENT REGISTRATION MVP - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- 1) ENUMS
-- ============================================

CREATE TYPE public.user_role AS ENUM ('athlete', 'organizer');
CREATE TYPE public.registration_type AS ENUM ('FREE', 'PAID');
CREATE TYPE public.registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.tournament_status AS ENUM ('OPEN', 'CLOSED');

-- 2) TABLES
-- ============================================

-- Base profile (shared fields)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Athlete-specific profile
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL,
  gender TEXT,
  club_name TEXT,
  height_cm NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizer-specific profile
CREATE TABLE public.organizer_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tournaments
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  location_text TEXT NOT NULL,
  location_map_url TEXT,
  poster_image_url TEXT,
  registration_type public.registration_type NOT NULL DEFAULT 'FREE',
  external_payment_url TEXT,
  max_participants INTEGER,
  status public.tournament_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paid_needs_url CHECK (
    registration_type = 'FREE' OR external_payment_url IS NOT NULL
  )
);

-- Registrations
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.registration_status NOT NULL DEFAULT 'PENDING',
  payment_screenshot_url TEXT,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, athlete_id)
);

-- 3) INDEXES
-- ============================================

CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_organizer ON public.tournaments(organizer_id);
CREATE INDEX idx_registrations_tournament ON public.registrations(tournament_id);
CREATE INDEX idx_registrations_athlete ON public.registrations(athlete_id);

-- 4) ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ATHLETE_PROFILES policies
CREATE POLICY "Athletes can read own athlete profile"
  ON public.athlete_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Athletes can insert own athlete profile"
  ON public.athlete_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Athletes can update own athlete profile"
  ON public.athlete_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organizers can view athlete profiles for registrations they manage
CREATE POLICY "Organizers can view athlete profiles for their tournaments"
  ON public.athlete_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.tournaments t ON t.id = r.tournament_id
      WHERE r.athlete_id = athlete_profiles.id
      AND t.organizer_id = auth.uid()
    )
  );

-- ORGANIZER_PROFILES policies
CREATE POLICY "Organizers can read own organizer profile"
  ON public.organizer_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Organizers can insert own organizer profile"
  ON public.organizer_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Organizers can update own organizer profile"
  ON public.organizer_profiles FOR UPDATE
  USING (auth.uid() = id);

-- TOURNAMENTS policies
CREATE POLICY "Anyone can read OPEN tournaments"
  ON public.tournaments FOR SELECT
  USING (status = 'OPEN' OR organizer_id = auth.uid());

CREATE POLICY "Organizers can create tournaments"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organizer'
    )
  );

CREATE POLICY "Organizers can update own tournaments"
  ON public.tournaments FOR UPDATE
  USING (auth.uid() = organizer_id);

-- REGISTRATIONS policies
CREATE POLICY "Athletes can read own registrations"
  ON public.registrations FOR SELECT
  USING (
    auth.uid() = athlete_id
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = registrations.tournament_id
      AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Athletes can create registrations"
  ON public.registrations FOR INSERT
  WITH CHECK (
    auth.uid() = athlete_id
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'athlete'
    )
  );

CREATE POLICY "Organizers can update registrations for own tournaments"
  ON public.registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = registrations.tournament_id
      AND t.organizer_id = auth.uid()
    )
  );

-- Organizers can read profiles of athletes registered to their tournaments
CREATE POLICY "Organizers can view registered athlete base profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.tournaments t ON t.id = r.tournament_id
      WHERE r.athlete_id = profiles.id
      AND t.organizer_id = auth.uid()
    )
  );

-- 5) STORAGE BUCKETS (run separately or via dashboard)
-- ============================================

-- Create storage buckets via Supabase Dashboard:
--
-- Bucket: "tournament-posters"
--   - Public: true (posters are public)
--
-- Bucket: "payment-screenshots"
--   - Public: false (private - only athlete + organizer can access)

-- Storage policies (run in SQL editor):

-- Tournament posters: public read, organizer upload
INSERT INTO storage.buckets (id, name, public) VALUES ('tournament-posters', 'tournament-posters', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', false);

-- Poster policies
CREATE POLICY "Anyone can view tournament posters"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tournament-posters');

CREATE POLICY "Organizers can upload tournament posters"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tournament-posters'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organizer'
    )
  );

-- Payment screenshot policies
CREATE POLICY "Athletes can upload payment screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'athlete'
    )
  );

CREATE POLICY "Athletes can view own payment screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Organizers can view payment screenshots for their tournaments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-screenshots'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organizer'
    )
  );
