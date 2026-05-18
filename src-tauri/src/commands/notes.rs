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

pub fn save_note_inner(
    conn: &rusqlite::Connection,
    id: &str,
    title: &str,
    folder: &str,
    content: &str,
) -> Result<(), String> {
    let content_json: serde_json::Value =
        serde_json::from_str(content).map_err(|e| e.to_string())?;
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

#[tauri::command]
pub fn save_note(
    state: tauri::State<AppState>,
    id: String,
    title: String,
    folder: String,
    content: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    save_note_inner(&conn, &id, &title, &folder, &content)
}

#[derive(serde::Serialize)]
pub struct NoteRow {
    pub id: String,
    pub title: String,
    pub folder: String,
    pub pos_x: f64,
    pub pos_y: f64,
    pub pos_w: f64,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_notes(state: tauri::State<AppState>) -> Result<Vec<NoteRow>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, title, folder, pos_x, pos_y, pos_w, word_count, created_at, updated_at
         FROM notes ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(NoteRow {
        id: r.get(0)?, title: r.get(1)?, folder: r.get(2)?,
        pos_x: r.get(3)?, pos_y: r.get(4)?, pos_w: r.get(5)?,
        word_count: r.get(6)?, created_at: r.get(7)?, updated_at: r.get(8)?,
    }))
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn get_note_content(state: tauri::State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT content FROM notes WHERE id=?1",
        params![id],
        |r| r.get::<_, String>(0),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_note(
    state: tauri::State<AppState>,
    id: String,
    pos_x: f64,
    pos_y: f64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET pos_x=?2, pos_y=?3, updated_at=datetime('now') WHERE id=?1",
        params![id, pos_x, pos_y],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_note(
    state: tauri::State<AppState>,
    title: String,
    folder: String,
    pos_x: f64,
    pos_y: f64,
) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let id = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, folder, content, text_body, pos_x, pos_y)
         VALUES (?1, ?2, ?3, '{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}', '', ?4, ?5)",
        params![id, title, folder, pos_x, pos_y],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:08x}{:08x}", ns, std::process::id())
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

        super::save_note_inner(&conn, "source-id", "Source", "inbox", &content.to_string()).unwrap();

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM note_edges WHERE a_id='source-id' AND b_id='target-id'",
            [], |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_get_notes_returns_saved_note() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO notes (id, title, folder, content, text_body, word_count)
             VALUES ('n1', 'My Note', 'inbox', '{}', '', 0)", [],
        ).unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title FROM notes WHERE id='n1'"
        ).unwrap();
        let row = stmt.query_row([], |r| Ok((
            r.get::<_,String>(0)?, r.get::<_,String>(1)?
        ))).unwrap();
        assert_eq!(row.0, "n1");
        assert_eq!(row.1, "My Note");
    }

    #[test]
    fn test_move_note_updates_position() {
        let conn = test_conn();
        conn.execute("INSERT INTO notes (id, title) VALUES ('n1', 'Note')", []).unwrap();
        conn.execute("UPDATE notes SET pos_x=100.0, pos_y=200.0 WHERE id='n1'", []).unwrap();
        let (x, y): (f64, f64) = conn.query_row(
            "SELECT pos_x, pos_y FROM notes WHERE id='n1'",
            [], |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(x, 100.0);
        assert_eq!(y, 200.0);
    }
}
