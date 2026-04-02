import { invoke } from "@tauri-apps/api/core"

export type Environment = "dev" | "staging" | "prod"

export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  environment: Environment
}

export const connectionsApi = {
  getAll: () =>
    invoke<ConnectionConfig[]>("get_connections"),

  create: (params: Omit<ConnectionConfig, "id">) =>
    invoke<ConnectionConfig>("create_connection", params),

  update: (config: ConnectionConfig) =>
    invoke<void>("update_connection", { config }),

  delete: (id: string) =>
    invoke<void>("delete_connection", { id }),

  test: (params: Pick<ConnectionConfig, "host" | "port" | "database" | "username" | "password">) =>
    invoke<void>("test_connection", params),
}
