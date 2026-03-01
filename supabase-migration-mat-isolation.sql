-- ============================================================
-- MIGRATION: Multi-Mat Isolation Fix
-- SAFE TO RUN MULTIPLE TIMES (idempotent)
-- Paste ENTIRE script into Supabase SQL Editor and run.
-- ============================================================

-- ============================
-- STEP 1: match_state table
-- ============================

-- 1a) Add mat_number column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_state'
      AND column_name = 'mat_number'
  ) THEN
    ALTER TABLE public.match_state ADD COLUMN mat_number INT NOT NULL DEFAULT 1;
    RAISE NOTICE 'Added mat_number column to match_state';
  ELSE
    RAISE NOTICE 'mat_number column already exists on match_state';
  END IF;
END $$;

-- 1b) Ensure all existing rows have mat_number = 1
UPDATE public.match_state SET mat_number = 1 WHERE mat_number IS NULL;

-- 1c) Drop existing primary key (whatever it is)
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT constraint_name INTO _constraint_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'match_state'
    AND constraint_type = 'PRIMARY KEY';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.match_state DROP CONSTRAINT %I', _constraint_name);
    RAISE NOTICE 'Dropped old PK constraint: %', _constraint_name;
  END IF;
END $$;

-- 1d) Create composite primary key
ALTER TABLE public.match_state ADD PRIMARY KEY (tournament_id, mat_number);

-- 1e) Verify
DO $$
DECLARE
  _cols TEXT;
BEGIN
  SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
  INTO _cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'match_state'
    AND tc.constraint_type = 'PRIMARY KEY';

  RAISE NOTICE 'match_state PK columns: %', _cols;

  IF _cols IS DISTINCT FROM 'tournament_id, mat_number' THEN
    RAISE EXCEPTION 'FAILED: match_state PK is (%) — expected (tournament_id, mat_number)', _cols;
  END IF;
END $$;


-- ============================
-- STEP 2: current_matches table
-- ============================

-- 2a) Add mat_number column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'current_matches'
      AND column_name = 'mat_number'
  ) THEN
    ALTER TABLE public.current_matches ADD COLUMN mat_number INT NOT NULL DEFAULT 1;
    RAISE NOTICE 'Added mat_number column to current_matches';
  ELSE
    RAISE NOTICE 'mat_number column already exists on current_matches';
  END IF;
END $$;

-- 2b) Ensure all existing rows have mat_number = 1
UPDATE public.current_matches SET mat_number = 1 WHERE mat_number IS NULL;

-- 2c) Drop existing primary key
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT constraint_name INTO _constraint_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'current_matches'
    AND constraint_type = 'PRIMARY KEY';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.current_matches DROP CONSTRAINT %I', _constraint_name);
    RAISE NOTICE 'Dropped old PK constraint: %', _constraint_name;
  END IF;
END $$;

-- 2d) Remove duplicates (keep newest per tournament_id + mat_number)
DELETE FROM public.current_matches a
USING public.current_matches b
WHERE a.tournament_id = b.tournament_id
  AND a.mat_number = b.mat_number
  AND a.ctid < b.ctid;

-- 2e) Create composite primary key
ALTER TABLE public.current_matches ADD PRIMARY KEY (tournament_id, mat_number);

-- 2f) Verify
DO $$
DECLARE
  _cols TEXT;
BEGIN
  SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
  INTO _cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'current_matches'
    AND tc.constraint_type = 'PRIMARY KEY';

  RAISE NOTICE 'current_matches PK columns: %', _cols;

  IF _cols IS DISTINCT FROM 'tournament_id, mat_number' THEN
    RAISE EXCEPTION 'FAILED: current_matches PK is (%) — expected (tournament_id, mat_number)', _cols;
  END IF;
END $$;


-- ============================
-- STEP 3: Indexes for performance
-- ============================
CREATE INDEX IF NOT EXISTS idx_match_state_tid_mat
  ON public.match_state (tournament_id, mat_number);
CREATE INDEX IF NOT EXISTS idx_current_matches_tid_mat
  ON public.current_matches (tournament_id, mat_number);


-- ============================
-- STEP 4: Ensure realtime is enabled
-- ============================
-- (safe to re-run; Postgres silently ignores duplicates)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_state;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'match_state already in realtime publication';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.current_matches;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'current_matches already in realtime publication';
END $$;


-- ============================
-- STEP 5: Final sanity check
-- ============================
DO $$
DECLARE
  _ms_count INT;
  _cm_count INT;
BEGIN
  SELECT count(*) INTO _ms_count FROM public.match_state;
  SELECT count(*) INTO _cm_count FROM public.current_matches;
  RAISE NOTICE 'Migration complete. match_state rows: %, current_matches rows: %', _ms_count, _cm_count;
  RAISE NOTICE 'Both tables now have PRIMARY KEY (tournament_id, mat_number)';
  RAISE NOTICE 'Each mat has its own isolated row. Timer on mat 1 cannot affect mat 2.';
END $$;
