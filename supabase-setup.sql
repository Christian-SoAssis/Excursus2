-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Notes table
CREATE TABLE notes (
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

-- Row Level Security: users can only access their own notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notes" ON notes
  USING       (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

-- Optional: index for fast updated_at queries
CREATE INDEX notes_updated_at_idx ON notes (user_id, updated_at DESC);
