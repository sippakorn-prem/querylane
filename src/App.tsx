import { useState, useEffect } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { Settings } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { SettingsModal } from "@/components/settings-modal"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/settings"

const ZOOM_STEP = 0.1
const ZOOM_MIN = 1.0
const ZOOM_MAX = 2.0

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10))
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { zoom, setZoom } = useSettingsStore()

  useEffect(() => {
    getCurrentWebview().setZoom(zoom)
  }, [zoom])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return
      const { zoom, setZoom } = useSettingsStore.getState()
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        setZoom(clampZoom(zoom + ZOOM_STEP))
      } else if (e.key === "-") {
        e.preventDefault()
        setZoom(clampZoom(zoom - ZOOM_STEP))
      } else if (e.key === "0") {
        e.preventDefault()
        setZoom(1)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function handleHeaderMouseDown(e: React.MouseEvent) {
    if (e.button === 0) {
      getCurrentWindow().startDragging()
    }
  }

  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground">
      <header
        className="flex h-10 shrink-0 items-center justify-between border-b border-border pl-20 pr-4"
        onMouseDown={handleHeaderMouseDown}
      >
        <span className="select-none text-sm font-medium text-foreground">Querylane</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="text-muted-foreground" />
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <EmptyState />
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
