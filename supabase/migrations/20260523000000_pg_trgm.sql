-- ================================================================
-- pg_trgm — Note similarity suggestions
-- ================================================================

-- 1. Enable the extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add plain-text column for clean similarity comparison
--    (populated by the app on every save; JSON noise would skew scores)
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS content_plain TEXT NOT NULL DEFAULT '';

-- 3. GIN index — makes similarity() fast even with thousands of notes
CREATE INDEX IF NOT EXISTS idx_notes_content_plain_trgm
  ON notes USING GIN (content_plain gin_trgm_ops);

-- 4. RPC: get_note_suggestions
--    Returns the top-5 most similar notes for a given note.
--    SECURITY DEFINER so the function runs as the owner and we can
--    do the user_id check ourselves — bypasses RLS safely.
CREATE OR REPLACE FUNCTION get_note_suggestions(
  p_note_id      TEXT,
  p_content      TEXT,
  p_threshold    FLOAT4 DEFAULT 0.15,
  p_limit        INT    DEFAULT 5
)
RETURNS TABLE (id TEXT, title TEXT, score FLOAT4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.title,
    similarity(n.content_plain, p_content)::FLOAT4 AS score
  FROM notes n
  WHERE n.id        != p_note_id
    AND n.user_id    = auth.uid()          -- owner check (replaces bypassed RLS)
    AND length(n.content_plain) > 30       -- skip stubs / empty notes
    AND similarity(n.content_plain, p_content) > p_threshold
  ORDER BY score DESC
  LIMIT p_limit;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_note_suggestions(TEXT, TEXT, FLOAT4, INT)
  TO authenticated;
