use serde::{Deserialize, Serialize};
use sqlx::postgres::PgConnectOptions;
use thiserror::Error;

// ── Types ─────────────────────────────────────────────────────────────────────

/// A saved database connection. Stored to disk, passed between frontend and backend.
///
/// `#[derive(Serialize, Deserialize)]` lets serde convert this to/from JSON automatically.
/// `#[derive(Clone)]` lets us copy the value when we need to pass it to async tasks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub environment: Environment,
}

/// `enum` in Rust is more powerful than in most languages — variants can carry data.
/// Here it's a simple tag, but it fully describes the three environment types.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Dev,
    Staging,
    Prod,
}

/// A custom error type for connection failures.
///
/// `thiserror::Error` generates the boilerplate for implementing std::error::Error.
/// Each variant maps to a human-readable message shown in the frontend.
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

// ── Logic ─────────────────────────────────────────────────────────────────────

/// Attempts to open a real Postgres connection and immediately closes it.
/// Returns Ok(()) if successful, or a ConnectionError describing why it failed.
///
/// `async fn` — this function yields to the Tokio runtime while waiting for the DB.
/// The caller must `.await` it.
pub async fn test_connection(config: &ConnectionConfig) -> Result<(), ConnectionError> {
    let options = build_connect_options(config);

    // `sqlx::PgPool::connect_with` tries to open a connection.
    // `map_err` transforms the sqlx error into our ConnectionError.
    let pool = sqlx::PgPool::connect_with(options)
        .await
        .map_err(classify_error)?;

    // Connection succeeded — close it immediately, we were just testing.
    pool.close().await;

    Ok(())
}

/// Builds sqlx connection options from a ConnectionConfig.
fn build_connect_options(config: &ConnectionConfig) -> PgConnectOptions {
    PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(&config.database)
        .username(&config.username)
        .password(&config.password)
}

/// Maps a raw sqlx error to a meaningful ConnectionError.
///
/// `sqlx::Error` is an enum — we match on its variants to produce helpful messages.
fn classify_error(err: sqlx::Error) -> ConnectionError {
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
