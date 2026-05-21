mod db;
mod commands;

use db::{AppState, setup_db};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()
                .expect("failed to get app data dir");
            let conn = setup_db(data_dir)
                .expect("failed to setup database");
            app.manage(AppState { db: Mutex::new(conn) });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::notes::save_note,
            commands::notes::get_notes,
            commands::notes::get_note_content,
            commands::notes::delete_note,
            commands::notes::move_note,
            commands::notes::create_note,
            commands::graph::get_graph,
            commands::search::search_notes,
            commands::oauth::start_oauth_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
