use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::mysql::{MySqlConnectOptions, MySqlConnection};
use sqlx::postgres::{PgConnectOptions, PgConnection};
use sqlx::{Column, Connection, Row, TypeInfo};
use thiserror::Error;

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DbType {
    Postgres,
    Mysql,
}

impl Default for DbType {
    fn default() -> Self {
        DbType::Postgres
    }
}

/// A saved database connection. Stored to disk, passed between frontend and backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub db_type: DbType,
    pub host: String,
    pub port: u16,
    /// Empty string means "no specific database" — connects to the server default.
    pub database: String,
    pub username: String,
    pub password: String,
    pub environment: Environment,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Dev,
    Staging,
    Prod,
}

#[derive(Debug, Error)]
pub enum ConnectionError {
    #[error("Connection refused — check host and port")]
    ConnectionRefused,
    #[error("Authentication failed — check username and password")]
    AuthFailed,
    #[error("Database '{0}' not found")]
    DatabaseNotFound(String),
    #[error("Connection timed out")]
    Timeout,
    #[error("{0}")]
    Other(String),
}

// ── Public API ────────────────────────────────────────────────────────────────

pub async fn test_connection(config: &ConnectionConfig) -> Result<(), ConnectionError> {
    match config.db_type {
        DbType::Postgres => test_postgres(config).await,
        DbType::Mysql => test_mysql(config).await,
    }
}

pub async fn list_databases(config: &ConnectionConfig) -> Result<Vec<String>, ConnectionError> {
    match config.db_type {
        DbType::Postgres => list_postgres_databases(config).await,
        DbType::Mysql => list_mysql_databases(config).await,
    }
}

pub async fn list_tables(config: &ConnectionConfig, database: &str) -> Result<Vec<String>, ConnectionError> {
    match config.db_type {
        DbType::Postgres => list_postgres_tables(config, database).await,
        DbType::Mysql => list_mysql_tables(config, database).await,
    }
}

async fn list_postgres_tables(config: &ConnectionConfig, database: &str) -> Result<Vec<String>, ConnectionError> {
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(database)
        .username(&config.username)
        .password(&config.password);

    let mut conn = PgConnection::connect_with(&options).await.map_err(classify_pg_error)?;

    let tables = sqlx::query_scalar::<_, String>(
        "SELECT table_name FROM information_schema.tables \
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE' \
         ORDER BY table_name",
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(tables)
}

async fn list_mysql_tables(config: &ConnectionConfig, database: &str) -> Result<Vec<String>, ConnectionError> {
    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password)
        .database(database);

    let mut conn = MySqlConnection::connect_with(&options).await.map_err(classify_mysql_error)?;

    let tables = sqlx::query_scalar::<_, String>(
        "SELECT table_name FROM information_schema.tables \
         WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' \
         ORDER BY table_name",
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(tables)
}

#[derive(Debug, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
}

pub async fn list_columns(config: &ConnectionConfig, database: &str, table: &str) -> Result<Vec<ColumnInfo>, ConnectionError> {
    match config.db_type {
        DbType::Postgres => list_postgres_columns(config, database, table).await,
        DbType::Mysql => list_mysql_columns(config, database, table).await,
    }
}

async fn list_postgres_columns(config: &ConnectionConfig, database: &str, table: &str) -> Result<Vec<ColumnInfo>, ConnectionError> {
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(database)
        .username(&config.username)
        .password(&config.password);

    let mut conn = PgConnection::connect_with(&options).await.map_err(classify_pg_error)?;

    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT column_name, data_type \
         FROM information_schema.columns \
         WHERE table_schema = 'public' AND table_name = $1 \
         ORDER BY ordinal_position",
    )
    .bind(table)
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(rows.into_iter().map(|(name, data_type)| ColumnInfo { name, data_type }).collect())
}

async fn list_mysql_columns(config: &ConnectionConfig, database: &str, table: &str) -> Result<Vec<ColumnInfo>, ConnectionError> {
    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password)
        .database(database);

    let mut conn = MySqlConnection::connect_with(&options).await.map_err(classify_mysql_error)?;

    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT column_name, data_type \
         FROM information_schema.columns \
         WHERE table_schema = DATABASE() AND table_name = ? \
         ORDER BY ordinal_position",
    )
    .bind(table)
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(rows.into_iter().map(|(name, data_type)| ColumnInfo { name, data_type }).collect())
}

pub async fn get_schema(config: &ConnectionConfig, database: &str) -> Result<std::collections::HashMap<String, Vec<String>>, ConnectionError> {
    match config.db_type {
        DbType::Postgres => get_postgres_schema(config, database).await,
        DbType::Mysql => get_mysql_schema(config, database).await,
    }
}

async fn get_postgres_schema(config: &ConnectionConfig, database: &str) -> Result<std::collections::HashMap<String, Vec<String>>, ConnectionError> {
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(database)
        .username(&config.username)
        .password(&config.password);

    let mut conn = PgConnection::connect_with(&options).await.map_err(classify_pg_error)?;

    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT table_name, column_name \
         FROM information_schema.columns \
         WHERE table_schema = 'public' \
         ORDER BY table_name, ordinal_position",
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(build_schema_map(rows))
}

async fn get_mysql_schema(config: &ConnectionConfig, database: &str) -> Result<std::collections::HashMap<String, Vec<String>>, ConnectionError> {
    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password)
        .database(database);

    let mut conn = MySqlConnection::connect_with(&options).await.map_err(classify_mysql_error)?;

    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT table_name, column_name \
         FROM information_schema.columns \
         WHERE table_schema = DATABASE() \
         ORDER BY table_name, ordinal_position",
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(build_schema_map(rows))
}

fn build_schema_map(rows: Vec<(String, String)>) -> std::collections::HashMap<String, Vec<String>> {
    let mut map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for (table, column) in rows {
        map.entry(table).or_default().push(column);
    }
    map
}

pub async fn execute_query(config: &ConnectionConfig, query: &str) -> Result<QueryResult, ConnectionError> {
    match config.db_type {
        DbType::Postgres => execute_postgres_query(config, query).await,
        DbType::Mysql => execute_mysql_query(config, query).await,
    }
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: u64,
    pub duration_ms: u64,
}

// ── Postgres ──────────────────────────────────────────────────────────────────

async fn test_postgres(config: &ConnectionConfig) -> Result<(), ConnectionError> {
    let db = if config.database.is_empty() { "postgres" } else { &config.database };
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(db)
        .username(&config.username)
        .password(&config.password);

    let conn = PgConnection::connect_with(&options)
        .await
        .map_err(classify_pg_error)?;
    conn.close().await.ok();
    Ok(())
}

async fn list_postgres_databases(config: &ConnectionConfig) -> Result<Vec<String>, ConnectionError> {
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database("postgres")
        .username(&config.username)
        .password(&config.password);

    let mut conn = PgConnection::connect_with(&options).await.map_err(classify_pg_error)?;

    let dbs = sqlx::query_scalar::<_, String>(
        "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
    )
    .fetch_all(&mut conn)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(dbs)
}

fn classify_pg_error(err: sqlx::Error) -> ConnectionError {
    let msg = err.to_string();
    if msg.contains("Connection refused") || msg.contains("connection refused") {
        ConnectionError::ConnectionRefused
    } else if msg.contains("password authentication failed") || msg.contains("authentication failed") {
        ConnectionError::AuthFailed
    } else if msg.contains("database") && msg.contains("does not exist") {
        ConnectionError::DatabaseNotFound(msg)
    } else if msg.contains("timed out") || msg.contains("timeout") {
        ConnectionError::Timeout
    } else {
        ConnectionError::Other(msg)
    }
}

// ── MySQL ─────────────────────────────────────────────────────────────────────

async fn test_mysql(config: &ConnectionConfig) -> Result<(), ConnectionError> {
    let mut options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password);

    if !config.database.is_empty() {
        options = options.database(&config.database);
    }

    let conn = MySqlConnection::connect_with(&options)
        .await
        .map_err(classify_mysql_error)?;
    conn.close().await.ok();
    Ok(())
}

async fn list_mysql_databases(config: &ConnectionConfig) -> Result<Vec<String>, ConnectionError> {
    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password);

    let mut conn = MySqlConnection::connect_with(&options).await.map_err(classify_mysql_error)?;

    let dbs = sqlx::query_scalar::<_, String>("SHOW DATABASES")
        .fetch_all(&mut conn)
        .await
        .map_err(|e| ConnectionError::Other(e.to_string()))?;

    conn.close().await.ok();
    Ok(dbs)
}

fn classify_mysql_error(err: sqlx::Error) -> ConnectionError {
    let msg = err.to_string();
    if msg.contains("Connection refused") || msg.contains("connection refused") {
        ConnectionError::ConnectionRefused
    } else if msg.contains("Access denied") {
        ConnectionError::AuthFailed
    } else if msg.contains("Unknown database") {
        ConnectionError::DatabaseNotFound(msg)
    } else if msg.contains("timed out") || msg.contains("timeout") {
        ConnectionError::Timeout
    } else {
        ConnectionError::Other(msg)
    }
}

// ── Execute query ─────────────────────────────────────────────────────────────

async fn execute_postgres_query(config: &ConnectionConfig, query: &str) -> Result<QueryResult, ConnectionError> {
    let db = if config.database.is_empty() { "postgres" } else { &config.database };
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(db)
        .username(&config.username)
        .password(&config.password);

    let mut conn = PgConnection::connect_with(&options).await.map_err(classify_pg_error)?;
    let start = std::time::Instant::now();

    let trimmed = query.trim().to_uppercase();
    let is_select = trimmed.starts_with("SELECT")
        || trimmed.starts_with("WITH")
        || trimmed.starts_with("(SELECT");

    let result = if is_select {
        let rows = sqlx::query(query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| ConnectionError::Other(e.to_string()))?;

        let duration_ms = start.elapsed().as_millis() as u64;

        if rows.is_empty() {
            QueryResult { columns: vec![], rows: vec![], rows_affected: 0, duration_ms }
        } else {
            let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
            let result_rows: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| (0..row.columns().len()).map(|i| pg_value_to_json(row, i)).collect())
                .collect();
            let count = result_rows.len() as u64;
            QueryResult { columns, rows: result_rows, rows_affected: count, duration_ms }
        }
    } else {
        let res = sqlx::query(query)
            .execute(&mut conn)
            .await
            .map_err(|e| ConnectionError::Other(e.to_string()))?;
        let duration_ms = start.elapsed().as_millis() as u64;
        QueryResult { columns: vec![], rows: vec![], rows_affected: res.rows_affected(), duration_ms }
    };

    conn.close().await.ok();
    Ok(result)
}

async fn execute_mysql_query(config: &ConnectionConfig, query: &str) -> Result<QueryResult, ConnectionError> {
    let mut options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password);

    if !config.database.is_empty() {
        options = options.database(&config.database);
    }

    let mut conn = MySqlConnection::connect_with(&options).await.map_err(classify_mysql_error)?;
    let start = std::time::Instant::now();

    let trimmed = query.trim().to_uppercase();
    let is_select = trimmed.starts_with("SELECT")
        || trimmed.starts_with("WITH")
        || trimmed.starts_with("(SELECT");

    let result = if is_select {
        let rows = sqlx::query(query)
            .fetch_all(&mut conn)
            .await
            .map_err(|e| ConnectionError::Other(e.to_string()))?;

        let duration_ms = start.elapsed().as_millis() as u64;

        if rows.is_empty() {
            QueryResult { columns: vec![], rows: vec![], rows_affected: 0, duration_ms }
        } else {
            let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().to_string()).collect();
            let result_rows: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| (0..row.columns().len()).map(|i| mysql_value_to_json(row, i)).collect())
                .collect();
            let count = result_rows.len() as u64;
            QueryResult { columns, rows: result_rows, rows_affected: count, duration_ms }
        }
    } else {
        let res = sqlx::query(query)
            .execute(&mut conn)
            .await
            .map_err(|e| ConnectionError::Other(e.to_string()))?;
        let duration_ms = start.elapsed().as_millis() as u64;
        QueryResult { columns: vec![], rows: vec![], rows_affected: res.rows_affected(), duration_ms }
    };

    conn.close().await.ok();
    Ok(result)
}

// ── Value serialisation ───────────────────────────────────────────────────────

fn pg_value_to_json(row: &sqlx::postgres::PgRow, i: usize) -> serde_json::Value {
    let type_name = row.columns()[i].type_info().name();
    match type_name {
        "INT2" => row.try_get::<Option<i16>, _>(i)
            .map(|v| v.map(|n| serde_json::Value::Number(n.into())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "INT4" | "SERIAL" => row.try_get::<Option<i32>, _>(i)
            .map(|v| v.map(|n| serde_json::Value::Number(n.into())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "INT8" | "BIGSERIAL" => row.try_get::<Option<i64>, _>(i)
            .map(|v| v.map(|n| serde_json::Value::Number(n.into())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "FLOAT4" => row.try_get::<Option<f32>, _>(i)
            .map(|v| v.map(|f| serde_json::json!(f)).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "FLOAT8" | "NUMERIC" => row.try_get::<Option<f64>, _>(i)
            .map(|v| v.map(|f| serde_json::json!(f)).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "BOOL" => row.try_get::<Option<bool>, _>(i)
            .map(|v| v.map(serde_json::Value::Bool).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "TIMESTAMP" => row.try_get::<Option<NaiveDateTime>, _>(i)
            .map(|v| v.map(|d| serde_json::Value::String(d.format("%Y-%m-%d %H:%M:%S").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "TIMESTAMPTZ" => row.try_get::<Option<DateTime<Utc>>, _>(i)
            .map(|v| v.map(|d| serde_json::Value::String(d.format("%Y-%m-%d %H:%M:%S UTC").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "DATE" => row.try_get::<Option<NaiveDate>, _>(i)
            .map(|v| v.map(|d| serde_json::Value::String(d.format("%Y-%m-%d").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "TIME" | "TIMETZ" => row.try_get::<Option<NaiveTime>, _>(i)
            .map(|v| v.map(|t| serde_json::Value::String(t.format("%H:%M:%S").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "UUID" => row.try_get::<Option<uuid::Uuid>, _>(i)
            .map(|v| v.map(|u| serde_json::Value::String(u.to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "BYTEA" => serde_json::Value::String("<binary>".to_string()),
        _ => row.try_get::<Option<String>, _>(i)
            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
            .unwrap_or_else(|_| serde_json::Value::String(format!("<{}>", type_name.to_lowercase()))),
    }
}

fn mysql_value_to_json(row: &sqlx::mysql::MySqlRow, i: usize) -> serde_json::Value {
    let type_name = row.columns()[i].type_info().name();
    match type_name {
        "TINYINT" | "SMALLINT" | "INT" | "MEDIUMINT" | "BIGINT"
        | "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "INT UNSIGNED"
        | "MEDIUMINT UNSIGNED" | "BIGINT UNSIGNED" => {
            row.try_get::<Option<i64>, _>(i)
                .map(|v| v.map(|n| serde_json::Value::Number(n.into())).unwrap_or(serde_json::Value::Null))
                .unwrap_or(serde_json::Value::Null)
        }
        "FLOAT" | "DOUBLE" | "DECIMAL" | "NUMERIC" => row.try_get::<Option<f64>, _>(i)
            .map(|v| v.map(|f| serde_json::json!(f)).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "BOOLEAN" => row.try_get::<Option<bool>, _>(i)
            .map(|v| v.map(serde_json::Value::Bool).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "DATETIME" | "TIMESTAMP" => row.try_get::<Option<NaiveDateTime>, _>(i)
            .map(|v| v.map(|d| serde_json::Value::String(d.format("%Y-%m-%d %H:%M:%S").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "DATE" => row.try_get::<Option<NaiveDate>, _>(i)
            .map(|v| v.map(|d| serde_json::Value::String(d.format("%Y-%m-%d").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "TIME" => row.try_get::<Option<NaiveTime>, _>(i)
            .map(|v| v.map(|t| serde_json::Value::String(t.format("%H:%M:%S").to_string())).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null),
        "BLOB" | "MEDIUMBLOB" | "LONGBLOB" | "TINYBLOB" => serde_json::Value::String("<binary>".to_string()),
        _ => row.try_get::<Option<String>, _>(i)
            .map(|v| v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null))
            .unwrap_or_else(|_| serde_json::Value::String(format!("<{}>", type_name.to_lowercase()))),
    }
}
