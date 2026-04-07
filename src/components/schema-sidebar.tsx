import { useEffect, useState } from "react"
import { ChevronRight, Loader2, Table2, AlertCircle } from "lucide-react"
import { connectionsApi, type ConnectionConfig } from "@/lib/connections"

interface Props {
  connection: ConnectionConfig
  onTableSelect: (database: string, table: string) => void
}

interface DbNode {
  name: string
  expanded: boolean
  tables: string[] | null
  loading: boolean
  error: string
}

export function SchemaSidebar({ connection, onTableSelect }: Props) {
  const [databases, setDatabases] = useState<DbNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const connParams = {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    db_type: connection.db_type,
  }

  useEffect(() => {
    connectionsApi.listDatabases(connParams)
      .then((dbs) => {
        setDatabases(dbs.map((name) => ({
          name,
          expanded: false,
          tables: null,
          loading: false,
          error: "",
        })))
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [connection.id])

  async function toggleDb(index: number) {
    const db = databases[index]

    if (db.expanded) {
      setDatabases((prev) => prev.map((d, i) => i === index ? { ...d, expanded: false } : d))
      return
    }

    if (db.tables !== null) {
      setDatabases((prev) => prev.map((d, i) => i === index ? { ...d, expanded: true } : d))
      return
    }

    setDatabases((prev) => prev.map((d, i) => i === index ? { ...d, expanded: true, loading: true, error: "" } : d))

    try {
      const tables = await connectionsApi.listTables({ ...connParams, database: db.name })
      setDatabases((prev) => prev.map((d, i) =>
        i === index ? { ...d, tables, loading: false } : d
      ))
    } catch (e) {
      setDatabases((prev) => prev.map((d, i) =>
        i === index ? { ...d, loading: false, error: String(e) } : d
      ))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center">
        <AlertCircle className="size-4 text-red-400" />
        <p className="text-xs text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col py-1">
      {databases.map((db, i) => (
        <div key={db.name}>
          {/* Database row */}
          <button
            onClick={() => toggleDb(i)}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronRight
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${db.expanded ? "rotate-90" : ""}`}
            />
            <span className="truncate font-medium">{db.name}</span>
            {db.loading && <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />}
          </button>

          {/* Tables */}
          {db.expanded && !db.loading && (
            <div>
              {db.error ? (
                <p className="px-8 py-1 text-xs text-red-400">{db.error}</p>
              ) : db.tables && db.tables.length === 0 ? (
                <p className="px-8 py-1 text-xs text-muted-foreground">No tables</p>
              ) : (
                db.tables?.map((table) => (
                  <button
                    key={table}
                    onClick={() => onTableSelect(db.name, table)}
                    className="flex w-full items-center gap-2 px-8 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <Table2 className="size-3.5 shrink-0" />
                    <span className="truncate">{table}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
