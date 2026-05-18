use crate::commands::notes::NoteRow;
use crate::db::AppState;
use rusqlite::params;

#[tauri::command]
pub fn search_notes(state: tauri::State<AppState>, query: String) -> Result<Vec<NoteRow>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let fts_query = format!("{query}*");
    let mut stmt = conn.prepare(
        "SELECT n.id, n.title, n.folder, n.pos_x, n.pos_y, n.pos_w,
                n.word_count, n.created_at, n.updated_at
         FROM notes n
         JOIN notes_fts f ON n.rowid = f.rowid
         WHERE notes_fts MATCH ?1
         ORDER BY rank"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![fts_query], |r| Ok(NoteRow {
        id: r.get(0)?, title: r.get(1)?, folder: r.get(2)?,
        pos_x: r.get(3)?, pos_y: r.get(4)?, pos_w: r.get(5)?,
        word_count: r.get(6)?, created_at: r.get(7)?, updated_at: r.get(8)?,
    }))
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use crate::db::migrations::migrations;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations().to_latest(&mut conn).unwrap();
        conn
    }

    #[test]
    fn test_fts_finds_note_by_title() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO notes (id, title, text_body) VALUES ('n1', 'Zettelkasten', 'notas atômicas')",
            [],
        ).unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH 'Zettelkasten*'",
            [], |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }
}
