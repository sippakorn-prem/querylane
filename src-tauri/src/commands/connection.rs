use tauri::AppHandle;
use uuid::Uuid;

use crate::db::{ConnectionConfig, DbType, Environment};
use crate::db::connection::{
    test_connection as db_test_connection,
    list_databases as db_list_databases,
    list_tables as db_list_tables,
    list_columns as db_list_columns,
    get_schema as db_get_schema,
    execute_query as db_execute_query,
    ColumnInfo, QueryResult,
};
use crate::db::storage::{load_connections, save_connections};

fn transient_config(db_type: DbType, host: String, port: u16, username: String, password: String, database: String) -> ConnectionConfig {
    ConnectionConfig { id: String::new(), name: String::new(), db_type, host, port, database, username, password, environment: Environment::Dev }
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_connections(app: AppHandle) -> Result<Vec<ConnectionConfig>, String> {
    load_connections(&app)
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_connection(
    app: AppHandle,
    name: String,
    db_type: DbType,
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
        db_type,
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

#[tauri::command]
pub fn delete_connection(app: AppHandle, id: String) -> Result<(), String> {
    let mut connections = load_connections(&app)?;
    connections.retain(|c| c.id != id);
    save_connections(&app, &connections)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn test_connection(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    db_type: DbType,
) -> Result<(), String> {
    let config = transient_config(db_type, host, port, username, password, database);
    db_test_connection(&config).await.map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_databases(
    host: String,
    port: u16,
    username: String,
    password: String,
    db_type: DbType,
) -> Result<Vec<String>, String> {
    let config = transient_config(db_type, host, port, username, password, String::new());
    db_list_databases(&config).await.map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_tables(
    host: String,
    port: u16,
    username: String,
    password: String,
    db_type: DbType,
    database: String,
) -> Result<Vec<String>, String> {
    let config = transient_config(db_type, host, port, username, password, database.clone());
    db_list_tables(&config, &database).await.map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn list_columns(
    host: String,
    port: u16,
    username: String,
    password: String,
    db_type: DbType,
    database: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let config = transient_config(db_type, host, port, username, password, database.clone());
    db_list_columns(&config, &database, &table).await.map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_schema(
    host: String,
    port: u16,
    username: String,
    password: String,
    db_type: DbType,
    database: String,
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    let config = transient_config(db_type, host, port, username, password, database.clone());
    db_get_schema(&config, &database).await.map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn execute_query(
    host: String,
    port: u16,
    username: String,
    password: String,
    db_type: DbType,
    database: String,
    query: String,
) -> Result<QueryResult, String> {
    let config = transient_config(db_type, host, port, username, password, database);
    db_execute_query(&config, &query).await.map_err(|e| e.to_string())
}
