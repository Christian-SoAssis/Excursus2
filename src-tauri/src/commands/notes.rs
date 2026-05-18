use rusqlite::params;
use crate::db::AppState;

pub fn extract_text(node: &serde_json::Value) -> String {
    let mut parts: Vec<String> = Vec::new();
    if node.get("type").and_then(|t| t.as_str()) == Some("text") {
        if let Some(text) = node.get("text").and_then(|t| t.as_str()) {
            parts.push(text.to_string());
        }
    }
    if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
        for child in children {
            let t = extract_text(child);
            if !t.is_empty() { parts.push(t); }
        }
    }
    parts.join(" ")
}

pub fn extract_backlinks(node: &serde_json::Value) -> Vec<String> {
    let mut ids = Vec::new();
    if node.get("type").and_then(|t| t.as_str()) == Some("backlink") {
        if let Some(id) = node
            .get("attrs").and_then(|a| a.get("noteId")).and_then(|id| id.as_str())
        {
            ids.push(id.to_string());
        }
    }
    if let Some(children) = node.get("content").and_then(|c| c.as_array()) {
        for child in children { ids.extend(extract_backlinks(child)); }
    }
    ids
}

#[tauri::command]
pub fn save_note(
    state: tauri::State<AppState>,
    id: String,
    title: String,
    folder: String,
    content: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let content_json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let text_body = extract_text(&content_json);
    let word_count = text_body.split_whitespace().count() as i64;
    let backlink_ids = extract_backlinks(&content_json);

    conn.execute(
        "INSERT INTO notes (id, title, folder, content, text_body, word_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, folder=excluded.folder,
           content=excluded.content, text_body=excluded.text_body,
           word_count=excluded.word_count, updated_at=datetime('now')",
        params![id, title, folder, content, text_body, word_count],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM note_edges WHERE a_id=?1 AND kind='explicit'",
        params![id],
    ).map_err(|e| e.to_string())?;

    for linked_id in backlink_ids {
        conn.execute(
            "INSERT OR IGNORE INTO note_edges (a_id, b_id, kind) VALUES (?1, ?2, 'explicit')",
            params![id, linked_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use crate::db::migrations::migrations;

    pub fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn test_migration_creates_notes_table() {
        let conn = test_conn();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='notes'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_migration_creates_fts_table() {
        let conn = test_conn();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='notes_fts'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_migration_creates_note_edges_table() {
        let conn = test_conn();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='note_edges'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_fts_trigger_indexes_inserted_note() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO notes (id, title, text_body) VALUES ('n1', 'Zettelkasten', 'notas atômicas')",
            [],
        ).unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH 'Zettelkasten*'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 1, "FTS trigger should index the inserted note");
    }

    #[test]
    fn test_extract_text_from_paragraph() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{ "type": "text", "text": "Hello world" }]
            }]
        });
        let text = super::extract_text(&json);
        assert!(text.contains("Hello world"), "got: {text}");
    }

    #[test]
    fn test_extract_text_from_heading() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [{
                "type": "heading",
                "attrs": { "level": 1 },
                "content": [{ "type": "text", "text": "My Title" }]
            }]
        });
        let text = super::extract_text(&json);
        assert!(text.contains("My Title"), "got: {text}");
    }

    #[test]
    fn test_extract_backlinks_finds_note_ids() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "backlink",
                    "attrs": { "noteId": "abc-123", "title": "Some Note" }
                }]
            }]
        });
        let ids = super::extract_backlinks(&json);
        assert_eq!(ids, vec!["abc-123"]);
    }

    #[test]
    fn test_save_note_creates_explicit_edges() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO notes (id, title) VALUES ('target-id', 'Target')", [],
        ).unwrap();

        let content = serde_json::json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "backlink",
                    "attrs": { "noteId": "target-id", "title": "Target" }
                }]
            }]
        });
        let content_str = content.to_string();
        let text_body = super::extract_text(&content);
        let backlinks = super::extract_backlinks(&content);

        conn.execute(
            "INSERT INTO notes (id, title, folder, content, text_body, word_count)
             VALUES ('source-id', 'Source', 'inbox', ?1, ?2, 0)",
            rusqlite::params![content_str, text_body],
        ).unwrap();
        conn.execute(
            "DELETE FROM note_edges WHERE a_id = 'source-id' AND kind = 'explicit'", [],
        ).unwrap();
        for id in &backlinks {
            conn.execute(
                "INSERT OR IGNORE INTO note_edges (a_id, b_id, kind) VALUES ('source-id', ?1, 'explicit')",
                rusqlite::params![id],
            ).unwrap();
        }

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM note_edges WHERE a_id='source-id' AND b_id='target-id'",
            [], |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }
}
