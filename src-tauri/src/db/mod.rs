pub mod migrations;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub fn setup_db(data_dir: std::path::PathBuf) -> Result<Connection, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("excursus.db");
    let mut conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    migrations::migrations().to_latest(&mut conn)?;
    Ok(conn)
}
