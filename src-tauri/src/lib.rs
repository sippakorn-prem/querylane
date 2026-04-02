mod commands;
mod db;

use commands::connection::{
    create_connection, delete_connection, get_connections, test_connection, update_connection,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_connections,
            create_connection,
            update_connection,
            delete_connection,
            test_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
