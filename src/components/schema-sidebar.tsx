import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Database, Loader2, AlertCircle, Columns3 } from "lucide-react"
import { connectionsApi, type ConnectionConfig, type ColumnInfo } from "@/lib/connections"

interface Props {
  connection: ConnectionConfig
  onTableSelect: (database: string, table: string, openInNewTab: boolean) => void
}

interface TableNode {
  name: string
  expanded: boolean
  columns: ColumnInfo[] | null
  loading: boolean
  error: string
}

interface DbNode {
  name: string
  expanded: boolean
  tables: TableNode[] | null
  loading: boolean
  error: string
}

// Abbreviate verbose SQL type names for compact display
function shortType(raw: string): string {
  return raw
    .replace("character varying", "varchar")
    .replace("character", "char")
    .replace("timestamp without time zone", "timestamp")
    .replace("timestamp with time zone", "timestamptz")
    .replace("time without time zone", "time")
    .replace("time with time zone", "timetz")
    .replace("double precision", "float8")
    .replace("integer", "int4")
    .replace("smallint", "int2")
    .replace("bigint", "int8")
    .replace("boolean", "bool")
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
      .then((dbs) => setDatabases(dbs.map((name) => ({
        name, expanded: false, tables: null, loading: false, error: "",
      }))))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [connection.id])

  async function toggleDb(dbIndex: number) {
    const db = databases[dbIndex]
    if (db.expanded) {
      setDatabases((prev) => prev.map((d, i) => i === dbIndex ? { ...d, expanded: false } : d))
      return
    }
    if (db.tables !== null) {
      setDatabases((prev) => prev.map((d, i) => i === dbIndex ? { ...d, expanded: true } : d))
      return
    }
    setDatabases((prev) => prev.map((d, i) => i === dbIndex ? { ...d, expanded: true, loading: true, error: "" } : d))
    try {
      const tableNames = await connectionsApi.listTables({ ...connParams, database: db.name })
      const tables: TableNode[] = tableNames.map((name) => ({
        name, expanded: false, columns: null, loading: false, error: "",
      }))
      setDatabases((prev) => prev.map((d, i) => i === dbIndex ? { ...d, tables, loading: false } : d))
    } catch (e) {
      setDatabases((prev) => prev.map((d, i) => i === dbIndex ? { ...d, loading: false, error: String(e) } : d))
    }
  }

  async function toggleTable(dbIndex: number, tableIndex: number) {
    const db = databases[dbIndex]
    const table = db.tables![tableIndex]

    if (table.expanded) {
      setDatabases((prev) => prev.map((d, di) =>
        di !== dbIndex ? d : {
          ...d, tables: d.tables!.map((t, ti) => ti === tableIndex ? { ...t, expanded: false } : t),
        }
      ))
      return
    }

    if (table.columns !== null) {
      setDatabases((prev) => prev.map((d, di) =>
        di !== dbIndex ? d : {
          ...d, tables: d.tables!.map((t, ti) => ti === tableIndex ? { ...t, expanded: true } : t),
        }
      ))
      return
    }

    setDatabases((prev) => prev.map((d, di) =>
      di !== dbIndex ? d : {
        ...d, tables: d.tables!.map((t, ti) =>
          ti === tableIndex ? { ...t, expanded: true, loading: true, error: "" } : t
        ),
      }
    ))

    try {
      const columns = await connectionsApi.listColumns({ ...connParams, database: db.name, table: table.name })
      setDatabases((prev) => prev.map((d, di) =>
        di !== dbIndex ? d : {
          ...d, tables: d.tables!.map((t, ti) =>
            ti === tableIndex ? { ...t, columns, loading: false } : t
          ),
        }
      ))
    } catch (e) {
      setDatabases((prev) => prev.map((d, di) =>
        di !== dbIndex ? d : {
          ...d, tables: d.tables!.map((t, ti) =>
            ti === tableIndex ? { ...t, loading: false, error: String(e) } : t
          ),
        }
      ))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-5 text-center">
        <AlertCircle className="size-4 text-red-400" />
        <p className="text-xs text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col py-1.5">
      {databases.map((db, di) => (
        <div key={db.name}>
          {/* Database row */}
          <button
            onClick={() => toggleDb(di)}
            className="group flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {db.expanded
              ? <ChevronDown className="size-[15px] shrink-0 text-muted-foreground" />
              : <ChevronRight className="size-[15px] shrink-0 text-muted-foreground" />
            }
            <Database className="size-[15px] shrink-0 text-foreground/70" />
            <span className="truncate text-sm font-medium text-foreground">{db.name}</span>
            {db.loading && <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" />}
          </button>

          {/* Tables */}
          {db.expanded && !db.loading && (
            <div>
              {db.error ? (
                <p className="py-1.5 pl-11 pr-4 text-xs text-red-400">{db.error}</p>
              ) : db.tables && db.tables.length === 0 ? (
                <p className="py-1.5 pl-11 pr-4 text-xs text-muted-foreground">No tables</p>
              ) : (
                db.tables?.map((table, ti) => (
                  <div key={table.name}>
                    {/* Table row */}
                    <div className="group flex w-full items-center hover:bg-muted/50 transition-colors">
                      {/* Expand chevron */}
                      <button
                        onClick={() => toggleTable(di, ti)}
                        className="flex shrink-0 items-center justify-center pl-8 pr-1 py-1.5 cursor-pointer text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        title="Show columns"
                      >
                        {table.loading
                          ? <Loader2 className="size-3 animate-spin" />
                          : table.expanded
                            ? <ChevronDown className="size-3" />
                            : <ChevronRight className="size-3" />
                        }
                      </button>

                      {/* Table name — click to run query, CMD+click to open new tab */}
                      <button
                        onClick={(e) => onTableSelect(db.name, table.name, e.metaKey)}
                        title={`SELECT * FROM ${table.name}  (⌘-click to open in new tab)`}
                        className="flex flex-1 min-w-0 items-center gap-2 py-1.5 pr-4 text-left cursor-pointer"
                      >
                        <Columns3 className="size-[14px] shrink-0 text-muted-foreground/60" />
                        <span className="truncate text-sm text-foreground/80">{table.name}</span>
                      </button>
                    </div>

                    {/* Columns */}
                    {table.expanded && !table.loading && (
                      <div>
                        {table.error ? (
                          <p className="py-1 pl-14 pr-4 text-xs text-red-400">{table.error}</p>
                        ) : table.columns && table.columns.length === 0 ? (
                          <p className="py-1 pl-14 pr-4 text-xs text-muted-foreground">No columns</p>
                        ) : (
                          table.columns?.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center gap-2 py-[3px] pl-14 pr-4"
                            >
                              <span className="truncate text-xs text-foreground/70">{col.name}</span>
                              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/50">
                                {shortType(col.data_type)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
