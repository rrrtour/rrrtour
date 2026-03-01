-- ============================================
-- MIGRATION: Add belt_rank to athlete_profiles
-- Run this in Supabase SQL Editor
-- ============================================

-- 1) Create the belt_rank enum
CREATE TYPE public.belt_rank AS ENUM (
  'white',
  'grey_white',
  'grey',
  'grey_black',
  'yellow_white',
  'yellow',
  'yellow_black',
  'orange_white',
  'orange',
  'orange_black',
  'green_white',
  'green',
  'green_black',
  'blue',
  'purple',
  'brown',
  'black'
);

-- 2) Add column to athlete_profiles (nullable)
ALTER TABLE public.athlete_profiles
  ADD COLUMN belt_rank public.belt_rank DEFAULT NULL;
