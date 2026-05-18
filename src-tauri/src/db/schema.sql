CREATE TABLE notes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title       TEXT NOT NULL DEFAULT 'Sem título',
  folder      TEXT NOT NULL DEFAULT 'inbox',
  content     TEXT NOT NULL DEFAULT '{}',
  text_body   TEXT NOT NULL DEFAULT '',
  pos_x       REAL NOT NULL DEFAULT 0,
  pos_y       REAL NOT NULL DEFAULT 0,
  pos_w       REAL NOT NULL DEFAULT 360,
  word_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, text_body,
  content=notes,
  content_rowid=rowid,
  tokenize="unicode61"
);

CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, text_body)
  VALUES (new.rowid, new.title, new.text_body);
END;

CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, text_body)
  VALUES ('delete', old.rowid, old.title, old.text_body);
  INSERT INTO notes_fts(rowid, title, text_body)
  VALUES (new.rowid, new.title, new.text_body);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, text_body)
  VALUES ('delete', old.rowid, old.title, old.text_body);
END;

CREATE TABLE note_edges (
  a_id   TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  b_id   TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  kind   TEXT NOT NULL CHECK (kind IN ('explicit', 'semantic', 'temporal')),
  weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (a_id, b_id, kind)
);
CREATE INDEX idx_note_edges_b ON note_edges(b_id);

CREATE TABLE folders (
  name       TEXT PRIMARY KEY,
  color_var  TEXT NOT NULL DEFAULT '--accent-terracotta',
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO folders (name, color_var, sort_order) VALUES
  ('inbox',     '--accent-terracotta', 0),
  ('método',    '--accent-terracotta', 1),
  ('técnico',   '--accent-emerald',    2),
  ('pessoas',   '--accent-electric',   3),
  ('ferramentas','--accent-amber',     4);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
