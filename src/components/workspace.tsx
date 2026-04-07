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
      <div className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Schema</p>
        </div>
        <SchemaSidebar connection={connection} onTableSelect={handleTableSelect} />
      </div>

      {/* Query + results */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeDatabase && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
            <span className="text-xs text-muted-foreground">Database:</span>
            <span className="text-xs font-medium text-foreground">{activeDatabase}</span>
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
