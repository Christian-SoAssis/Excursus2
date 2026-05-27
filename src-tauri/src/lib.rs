mod db;
mod commands;

use db::{AppState, setup_db};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ── Database ─────────────────────────────────────────────
            let data_dir = app.path().app_data_dir()
                .expect("failed to get app data dir");
            let conn = setup_db(data_dir)
                .expect("failed to setup database");
            app.manage(AppState { db: Mutex::new(conn) });

            // ── System tray ──────────────────────────────────────────
            #[cfg(desktop)]
            {
                use tauri_plugin_tray::TrayIconBuilder;
                let tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Excursus 2 — clique para captura rápida")
                    .build(app)?;

                let app_handle = app.handle().clone();
                tray.on_tray_icon_event(move |_tray, event| {
                    use tauri_plugin_tray::TrayIconEvent;
                    if let TrayIconEvent::Click { .. } = event {
                        // Show main window and emit open-quick-capture
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                            let _ = win.emit("open-quick-capture", ());
                        }
                    }
                });
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_tray::init())
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
