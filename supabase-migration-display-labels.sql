-- ============================================================
-- MIGRATION: Add editable display labels to match_state
-- Safe to run multiple times (idempotent)
-- ============================================================

ALTER TABLE public.match_state
  ADD COLUMN IF NOT EXISTS display_label_1 TEXT DEFAULT NULL;

ALTER TABLE public.match_state
  ADD COLUMN IF NOT EXISTS display_label_2 TEXT DEFAULT NULL;
