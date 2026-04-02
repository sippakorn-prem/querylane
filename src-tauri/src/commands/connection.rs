use tauri::AppHandle;
use uuid::Uuid;

use crate::db::{ConnectionConfig, Environment};
use crate::db::connection::test_connection as db_test_connection;
use crate::db::storage::{load_connections, save_connections};

// ── Commands ──────────────────────────────────────────────────────────────────
//
// Each function here is a thin bridge: validate input, call db/, return result.
// No business logic lives here — it all lives in db/.

/// Returns all saved connections.
#[tauri::command]
pub fn get_connections(app: AppHandle) -> Result<Vec<ConnectionConfig>, String> {
    load_connections(&app)
}

/// Saves a new connection. Generates a new UUID for it.
#[tauri::command]
pub fn create_connection(
    app: AppHandle,
    name: String,
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    environment: Environment,
) -> Result<ConnectionConfig, String> {
    let mut connections = load_connections(&app)?;

    let config = ConnectionConfig {
        id: Uuid::new_v4().to_string(),
        name,
        host,
        port,
        database,
        username,
        password,
        environment,
    };

    connections.push(config.clone());
    save_connections(&app, &connections)?;

    Ok(config)
}

/// Overwrites an existing connection by id.
#[tauri::command]
pub fn update_connection(app: AppHandle, config: ConnectionConfig) -> Result<(), String> {
    let mut connections = load_connections(&app)?;

    let pos = connections
        .iter()
        .position(|c| c.id == config.id)
        .ok_or_else(|| format!("Connection '{}' not found", config.id))?;

    connections[pos] = config;
    save_connections(&app, &connections)
}

/// Removes a connection by id.
#[tauri::command]
pub fn delete_connection(app: AppHandle, id: String) -> Result<(), String> {
    let mut connections = load_connections(&app)?;
    connections.retain(|c| c.id != id);
    save_connections(&app, &connections)
}

/// Tries to open a real Postgres connection and closes it immediately.
/// Used by the "Test connection" button before saving.
///
/// `async` because sqlx network calls must be awaited.
#[tauri::command]
pub async fn test_connection(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let config = ConnectionConfig {
        id: String::new(),
        name: String::new(),
        host,
        port,
        database,
        username,
        password,
        environment: Environment::Dev,
    };

    db_test_connection(&config)
        .await
        .map_err(|e| e.to_string())
}
