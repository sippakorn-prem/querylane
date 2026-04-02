use std::fs;
use std::path::PathBuf;

use serde_json;
use tauri::Manager;

use crate::db::ConnectionConfig;

/// Returns the path to connections.json in the app's data directory.
///
/// `app` is a Tauri AppHandle — it gives us access to app-managed paths.
/// On macOS this resolves to ~/Library/Application Support/com.sippakorn-prem.querylane/
fn connections_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("could not resolve app data dir")
        .join("connections.json")
}

/// Loads all saved connections from disk.
///
/// `Vec<ConnectionConfig>` — a growable list of connections (like Array in TS).
/// Returns an empty Vec if the file doesn't exist yet (first launch).
pub fn load_connections(app: &tauri::AppHandle) -> Result<Vec<ConnectionConfig>, String> {
    let path = connections_path(app);

    if !path.exists() {
        return Ok(Vec::new());
    }

    // `fs::read_to_string` reads the file. The `?` propagates any IO error as Err(String).
    // `map_err` converts the error type to String so we can use `?`.
    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let connections = serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(connections)
}

/// Persists the full list of connections to disk, replacing the file.
pub fn save_connections(
    app: &tauri::AppHandle,
    connections: &[ConnectionConfig],
) -> Result<(), String> {
    let path = connections_path(app);

    // Ensure the parent directory exists before writing.
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }

    let contents = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
    fs::write(&path, contents).map_err(|e| e.to_string())?;

    Ok(())
}
