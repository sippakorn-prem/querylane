import { invoke } from "@tauri-apps/api/core"

export type DbType = "postgres" | "mysql"
export type Environment = "dev" | "staging" | "prod"

export interface ConnectionConfig {
  id: string
  name: string
  db_type: DbType
  host: string
  port: number
  database: string
  username: string
  password: string
  environment: Environment
}

export interface ColumnInfo {
  name: string
  data_type: string
}

export interface QueryResult {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  rows_affected: number
  duration_ms: number
}

type ConnParams = Pick<ConnectionConfig, "host" | "port" | "username" | "password" | "db_type">

export const connectionsApi = {
  getAll: () =>
    invoke<ConnectionConfig[]>("get_connections"),

  create: (params: Omit<ConnectionConfig, "id">) =>
    invoke<ConnectionConfig>("create_connection", params),

  update: (config: ConnectionConfig) =>
    invoke<void>("update_connection", { config }),

  delete: (id: string) =>
    invoke<void>("delete_connection", { id }),

  test: (params: ConnParams & { database: string }) =>
    invoke<void>("test_connection", params),

  listDatabases: (params: ConnParams) =>
    invoke<string[]>("list_databases", params),

  listTables: (params: ConnParams & { database: string }) =>
    invoke<string[]>("list_tables", params),

  listColumns: (params: ConnParams & { database: string; table: string }) =>
    invoke<ColumnInfo[]>("list_columns", params),

  getSchema: (params: ConnParams & { database: string }) =>
    invoke<Record<string, string[]>>("get_schema", params),

  executeQuery: (params: ConnParams & { database: string; query: string }) =>
    invoke<QueryResult>("execute_query", params),
}
