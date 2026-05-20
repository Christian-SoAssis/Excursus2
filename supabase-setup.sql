-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS and DROP IF EXISTS where needed.

-- ================================================================
-- Notes table
-- ================================================================
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  title       TEXT        NOT NULL DEFAULT '',
  folder      TEXT        NOT NULL DEFAULT 'inbox',
  content     TEXT        NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
  pos_x       FLOAT       NOT NULL DEFAULT 120,
  pos_y       FLOAT       NOT NULL DEFAULT 120,
  pos_w       FLOAT       NOT NULL DEFAULT 320,
  word_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_notes" ON notes;
CREATE POLICY "users_own_notes" ON notes
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes (user_id, updated_at DESC);

-- ================================================================
-- Home data (habits, tasks, reflections)
-- ================================================================
CREATE TABLE IF NOT EXISTS home_data (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users,
  habits     JSONB       NOT NULL DEFAULT '[]',
  tasks      JSONB       NOT NULL DEFAULT '[]',
  reflect    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE home_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_home_data" ON home_data;
CREATE POLICY "users_own_home_data" ON home_data
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- Storage bucket for images and PDFs
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('uploads', 'uploads', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "auth users can upload"  ON storage.objects;
DROP POLICY IF EXISTS "public read uploads"    ON storage.objects;
DROP POLICY IF EXISTS "owners can delete uploads" ON storage.objects;

CREATE POLICY "auth users can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "public read uploads"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'uploads');

CREATE POLICY "owners can delete uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
