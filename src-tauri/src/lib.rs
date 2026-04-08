mod commands;
mod db;

use commands::connection::{
    create_connection, delete_connection, execute_query, get_connections, get_schema,
    list_databases, list_tables, test_connection, update_connection,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_connections,
            create_connection,
            update_connection,
            delete_connection,
            test_connection,
            list_databases,
            list_tables,
            get_schema,
            execute_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
