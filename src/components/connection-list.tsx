import { useEffect, useState } from "react"
import { Plus, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ConnectionConfig, Environment } from "@/lib/connections"

interface ConnectionListProps {
  connections: ConnectionConfig[]
  onAdd: () => void
  onEdit: (connection: ConnectionConfig) => void
  onDelete: (id: string) => void
  onConnect: (connection: ConnectionConfig) => void
}

const ENV_DOT: Record<Environment, string> = {
  dev: "bg-green-500",
  staging: "bg-yellow-500",
  prod: "bg-red-500",
}

const ENV_LABEL: Record<Environment, string> = {
  dev: "dev",
  staging: "stg",
  prod: "prod",
}

const ENV_BADGE: Record<Environment, string> = {
  dev: "text-green-500 bg-green-500/10",
  staging: "text-yellow-500 bg-yellow-500/10",
  prod: "text-red-500 bg-red-500/10",
}

export function ConnectionList({ connections, onAdd, onEdit, onDelete, onConnect }: ConnectionListProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    function close() { setMenuOpen(null) }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [menuOpen])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Connections</span>
        <Button size="sm" onClick={onAdd}>
          <Plus />
          Add
        </Button>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {connections.map((conn, index) => {
          const subtitle = conn.database
            ? `${conn.host}:${conn.port}/${conn.database}`
            : `${conn.host}:${conn.port}`

          return (
            <li
              key={conn.id}
              className="animate-in fade-in-0 slide-in-from-left-2 duration-200 ease-out group relative flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
              style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
              onClick={() => onConnect(conn)}
            >
              <span className={`size-2 shrink-0 rounded-full ${ENV_DOT[conn.environment]}`} />

              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                <span className="truncate text-sm text-foreground">{conn.name}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              </div>

              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${ENV_BADGE[conn.environment]}`}>
                {ENV_LABEL[conn.environment]}
              </span>

              {/* Three-dot menu */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(menuOpen === conn.id ? null : conn.id)
                  }}
                >
                  <MoreHorizontal className="size-4" />
                </button>

                {menuOpen === conn.id && (
                  <div className="animate-in fade-in-0 zoom-in-95 duration-100 ease-out absolute right-0 top-7 z-20 min-w-[120px] rounded-md border border-border bg-card py-1 shadow-lg">
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                      onClick={() => { onEdit(conn); setMenuOpen(null) }}
                    >
                      Edit
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-muted"
                      onClick={() => { onDelete(conn.id); setMenuOpen(null) }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
