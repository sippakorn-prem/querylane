import { useState } from "react"
import { SchemaSidebar } from "@/components/schema-sidebar"
import { QueryEditor } from "@/components/query-editor"
import type { ConnectionConfig } from "@/lib/connections"

interface Props {
  connection: ConnectionConfig
}

export function Workspace({ connection }: Props) {
  const [activeDatabase, setActiveDatabase] = useState(connection.database ?? "")
  const [query, setQuery] = useState("SELECT 1")

  function handleTableSelect(database: string, table: string) {
    setActiveDatabase(database)
    setQuery(`SELECT *\nFROM ${table}\nLIMIT 100`)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Schema sidebar */}
      <div className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{connection.name}</p>
        </div>
        <SchemaSidebar connection={connection} onTableSelect={handleTableSelect} />
      </div>

      {/* Query + results */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeDatabase && (
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-1">
            <span className="text-[11px] text-muted-foreground">db</span>
            <span className="text-[11px] text-muted-foreground">/</span>
            <span className="text-[11px] font-medium text-foreground">{activeDatabase}</span>
          </div>
        )}
        <QueryEditor
          connection={connection}
          activeDatabase={activeDatabase}
          query={query}
          onQueryChange={setQuery}
        />
      </div>
    </div>
  )
}
