import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "dark" | "light" | "system"

interface SettingsState {
  theme: Theme
  zoom: number
  confirmOnDelete: boolean
  confirmOnDrop: boolean
  confirmOnTruncate: boolean
  confirmOnUpdateWithoutWhere: boolean

  setTheme: (theme: Theme) => void
  setZoom: (zoom: number) => void
  setConfirmOnDelete: (value: boolean) => void
  setConfirmOnDrop: (value: boolean) => void
  setConfirmOnTruncate: (value: boolean) => void
  setConfirmOnUpdateWithoutWhere: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      zoom: 1,
      confirmOnDelete: true,
      confirmOnDrop: true,
      confirmOnTruncate: true,
      confirmOnUpdateWithoutWhere: true,

      setTheme: (theme) => set({ theme }),
      setZoom: (zoom) => set((s) => s.zoom === zoom ? s : { zoom }),
      setConfirmOnDelete: (confirmOnDelete) => set({ confirmOnDelete }),
      setConfirmOnDrop: (confirmOnDrop) => set({ confirmOnDrop }),
      setConfirmOnTruncate: (confirmOnTruncate) => set({ confirmOnTruncate }),
      setConfirmOnUpdateWithoutWhere: (confirmOnUpdateWithoutWhere) =>
        set({ confirmOnUpdateWithoutWhere }),
    }),
    { name: "querylane-settings", version: 3 }
  )
)
