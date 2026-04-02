import { create } from "zustand"
import { connectionsApi, type ConnectionConfig } from "@/lib/connections"

interface ConnectionsState {
  connections: ConnectionConfig[]
  isLoading: boolean
  load: () => Promise<void>
  add: (config: ConnectionConfig) => void
  update: (config: ConnectionConfig) => void
  remove: (id: string) => void
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
  connections: [],
  isLoading: true,

  load: async () => {
    const connections = await connectionsApi.getAll()
    set({ connections, isLoading: false })
  },

  add: (config) =>
    set((s) => ({ connections: [...s.connections, config] })),

  update: (config) =>
    set((s) => ({
      connections: s.connections.map((c) => (c.id === config.id ? config : c)),
    })),

  remove: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
}))
