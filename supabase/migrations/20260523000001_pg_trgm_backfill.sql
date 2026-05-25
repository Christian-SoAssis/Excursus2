-- ================================================================
-- Backfill content_plain for notes saved before pg_trgm migration
-- Extracts all "text":"..." values from the TipTap JSON string
-- ================================================================

UPDATE notes
SET content_plain = (
  SELECT coalesce(string_agg(val[1], ' '), '')
  FROM regexp_matches(
    content,
    '"text"\s*:\s*"((?:[^"\\]|\\.)*)"',
    'g'
  ) t(val)
)
WHERE content_plain = ''
  AND content IS NOT NULL
  AND length(content) > 2;
