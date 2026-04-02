import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ConnectionConfig, Environment } from "@/lib/connections"

interface ConnectionListProps {
  connections: ConnectionConfig[]
  onAdd: () => void
  onEdit: (connection: ConnectionConfig) => void
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

export function ConnectionList({ connections, onAdd, onEdit, onConnect }: ConnectionListProps) {
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
        {connections.map((conn) => (
          <li
            key={conn.id}
            className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
            onClick={() => onConnect(conn)}
            onDoubleClick={() => onEdit(conn)}
          >
            <span className={`size-2 shrink-0 rounded-full ${ENV_DOT[conn.environment]}`} />

            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <span className="truncate text-sm text-foreground">{conn.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {conn.host}:{conn.port}/{conn.database}
              </span>
            </div>

            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${ENV_BADGE[conn.environment]}`}>
              {ENV_LABEL[conn.environment]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
