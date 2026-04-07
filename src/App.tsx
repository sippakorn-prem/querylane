import { useState, useEffect } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { Settings, ArrowLeft } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { ConnectionList } from "@/components/connection-list"
import { ConnectionPanel } from "@/components/connection-panel"
import { SettingsModal } from "@/components/settings-modal"
import { Workspace } from "@/components/workspace"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/settings"
import { useConnectionsStore } from "@/store/connections"
import { connectionsApi, type ConnectionConfig } from "@/lib/connections"

const ZOOM_STEP = 0.1
const ZOOM_MIN = 1.0
const ZOOM_MAX = 2.0

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10))
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>()
  const [activeConnection, setActiveConnection] = useState<ConnectionConfig | null>(null)
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
  const { zoom, theme } = useSettingsStore()
  const { connections, isLoading, load, remove } = useConnectionsStore()

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const isDark = theme === "dark" || (theme === "system" && systemDark)

  useEffect(() => { load() }, [])

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
    if (e.button === 0) getCurrentWindow().startDragging()
  }

  function openAdd() {
    setEditingConnection(undefined)
    setPanelOpen(true)
  }

  function openEdit(conn: ConnectionConfig) {
    setEditingConnection(conn)
    setPanelOpen(true)
  }

  async function handleDelete(id: string) {
    await connectionsApi.delete(id)
    remove(id)
  }

  function handleConnect(conn: ConnectionConfig) {
    setActiveConnection(conn)
    setPanelOpen(false)
  }

  const showEmpty = !isLoading && connections.length === 0

  return (
    <div className={`${isDark ? "dark" : ""} flex h-screen flex-col bg-background text-foreground`}>
      <header
        className="flex h-10 shrink-0 items-center justify-between border-b border-border pl-20 pr-4"
        onMouseDown={handleHeaderMouseDown}
      >
        {activeConnection ? (
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" onClick={() => setActiveConnection(null)}>
              <ArrowLeft className="text-muted-foreground" />
            </Button>
            <span className="select-none text-sm font-medium text-foreground">{activeConnection.name}</span>
            <EnvBadge env={activeConnection.environment} />
          </div>
        ) : (
          <span className="select-none text-sm font-medium text-foreground">Querylane</span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="text-muted-foreground" />
        </Button>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {activeConnection ? (
          <Workspace connection={activeConnection} />
        ) : (
          <>
            {showEmpty ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState onAddConnection={openAdd} />
              </div>
            ) : (
              <ConnectionList
                connections={connections}
                onAdd={openAdd}
                onEdit={openEdit}
                onDelete={handleDelete}
                onConnect={handleConnect}
              />
            )}

            {panelOpen && (
              <ConnectionPanel
                editing={editingConnection}
                onClose={() => setPanelOpen(false)}
              />
            )}
          </>
        )}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

// ── Small components ──────────────────────────────────────────────────────────

const ENV_STYLES = {
  dev: "bg-green-500/15 text-green-500",
  staging: "bg-yellow-500/15 text-yellow-500",
  prod: "bg-red-500/15 text-red-500",
}

function EnvBadge({ env }: { env: "dev" | "staging" | "prod" }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ENV_STYLES[env]}`}>
      {env}
    </span>
  )
}
