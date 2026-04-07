import { useEffect, useState } from "react"
import { Plus, MoreHorizontal, Search } from "lucide-react"
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

const ENV_TEXT: Record<Environment, string> = {
  dev: "text-green-600 dark:text-green-500",
  staging: "text-amber-600 dark:text-yellow-500",
  prod: "text-red-600 dark:text-red-500",
}

const ENV_LABEL: Record<Environment, string> = {
  dev: "dev",
  staging: "staging",
  prod: "prod",
}

const DB_BADGE: Record<string, string> = {
  postgres: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  mysql: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
}

const DB_LABEL: Record<string, string> = {
  postgres: "PG",
  mysql: "MY",
}

export function ConnectionList({ connections, onAdd, onEdit, onDelete, onConnect }: ConnectionListProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!menuOpen) return
    function close() { setMenuOpen(null) }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [menuOpen])

  const filtered = search.trim()
    ? connections.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.host.toLowerCase().includes(search.toLowerCase()) ||
        (c.database ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : connections

  return (
    <div className="bg-grid flex flex-1 items-start justify-center overflow-y-auto px-4 pt-12 pb-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="text-sm font-semibold text-foreground">Connections</span>
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-3.5" />
              New
            </Button>
          </div>

          {/* Search */}
          <div className="border-b border-border px-4 py-2.5">
            <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-ring/60 transition-colors">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connections…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {search ? "No connections match your search" : "No connections yet"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((conn, index) => {
                const subtitle = conn.database
                  ? `${conn.host}:${conn.port}/${conn.database}`
                  : `${conn.host}:${conn.port}`

                return (
                  <li
                    key={conn.id}
                    className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out group relative flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    style={{ animationDelay: `${index * 30}ms`, animationFillMode: "both" }}
                    onClick={() => onConnect(conn)}
                  >
                    {/* DB type badge */}
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-wide ${DB_BADGE[conn.db_type] ?? "bg-muted text-muted-foreground"}`}>
                      {DB_LABEL[conn.db_type] ?? conn.db_type.toUpperCase().slice(0, 2)}
                    </span>

                    {/* Name + host */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{conn.name}</span>
                        <span className={`shrink-0 text-[11px] font-medium ${ENV_TEXT[conn.environment]}`}>
                          {ENV_LABEL[conn.environment]}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
                    </div>

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
                        <div className="animate-in fade-in-0 zoom-in-95 duration-100 ease-out absolute right-0 top-7 z-20 min-w-[120px] rounded-lg border border-border bg-card py-1 shadow-lg">
                          <button
                            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                            onClick={() => { onEdit(conn); setMenuOpen(null) }}
                          >
                            Edit
                          </button>
                          <button
                            className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-muted"
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
          )}
        </div>
      </div>
    </div>
  )
}
