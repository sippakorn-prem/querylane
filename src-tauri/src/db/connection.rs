use serde::{Deserialize, Serialize};
use sqlx::postgres::PgConnectOptions;
use sqlx::mysql::MySqlConnectOptions;
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

// ── Postgres ──────────────────────────────────────────────────────────────────

async fn test_postgres(config: &ConnectionConfig) -> Result<(), ConnectionError> {
    let db = if config.database.is_empty() { "postgres" } else { &config.database };
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(db)
        .username(&config.username)
        .password(&config.password);

    let pool = sqlx::PgPool::connect_with(options)
        .await
        .map_err(classify_pg_error)?;
    pool.close().await;
    Ok(())
}

async fn list_postgres_databases(config: &ConnectionConfig) -> Result<Vec<String>, ConnectionError> {
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database("postgres")
        .username(&config.username)
        .password(&config.password);

    let pool = sqlx::PgPool::connect_with(options)
        .await
        .map_err(classify_pg_error)?;

    let dbs = sqlx::query_scalar::<_, String>(
        "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| ConnectionError::Other(e.to_string()))?;

    pool.close().await;
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

    let pool = sqlx::MySqlPool::connect_with(options)
        .await
        .map_err(classify_mysql_error)?;
    pool.close().await;
    Ok(())
}

async fn list_mysql_databases(config: &ConnectionConfig) -> Result<Vec<String>, ConnectionError> {
    let options = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password);

    let pool = sqlx::MySqlPool::connect_with(options)
        .await
        .map_err(classify_mysql_error)?;

    let dbs = sqlx::query_scalar::<_, String>("SHOW DATABASES")
        .fetch_all(&pool)
        .await
        .map_err(|e| ConnectionError::Other(e.to_string()))?;

    pool.close().await;
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
