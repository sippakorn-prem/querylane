import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface HistoryEntry {
  id: string
  query: string
  connectionId: string
  connectionName: string
  executedAt: number
  duration_ms: number
  rowCount: number
}

interface HistoryState {
  entries: HistoryEntry[]
  add: (entry: Omit<HistoryEntry, "id">) => void
  remove: (id: string) => void
  clear: () => void
}

const MAX_ENTRIES = 200

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) =>
        set((s) => ({
          entries: [{ ...entry, id: crypto.randomUUID() }, ...s.entries].slice(0, MAX_ENTRIES),
        })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    { name: "querylane-history", version: 1 }
  )
)
