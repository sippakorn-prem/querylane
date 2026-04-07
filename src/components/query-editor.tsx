import { useEffect, useRef, useState } from "react"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { connectionsApi, type ConnectionConfig, type QueryResult } from "@/lib/connections"
import { detectDestructive, type DestructiveWarning } from "@/lib/query-safety"

interface Props {
  connection: ConnectionConfig
  activeDatabase: string
  query: string
  onQueryChange: (q: string) => void
}

type RunState = "idle" | "running" | "done" | "error"

export function QueryEditor({ connection, activeDatabase, query, onQueryChange }: Props) {
  const [runState, setRunState] = useState<RunState>("idle")
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState<DestructiveWarning | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus editor on mount
  useEffect(() => { textareaRef.current?.focus() }, [])

  async function executeNow() {
    setRunState("running")
    setResult(null)
    setError("")

    try {
      const res = await connectionsApi.executeQuery({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        db_type: connection.db_type,
        database: activeDatabase || connection.database,
        query,
      })
      setResult(res)
      setRunState("done")
    } catch (e) {
      setError(String(e))
      setRunState("error")
    }
  }

  function runQuery() {
    if (!query.trim() || runState === "running") return

    const w = detectDestructive(query)
    if (w) {
      setWarning(w)
      return
    }

    executeNow()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.metaKey && e.key === "Enter") {
      e.preventDefault()
      runQuery()
    }
  }

  const statusText = (() => {
    if (runState === "running") return "Running…"
    if (runState === "error") return null
    if (!result) return null
    const rows = result.columns.length > 0
      ? `${result.rows_affected} row${result.rows_affected !== 1 ? "s" : ""}`
      : `${result.rows_affected} row${result.rows_affected !== 1 ? "s" : ""} affected`
    return `${rows} · ${result.duration_ms}ms`
  })()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Editor */}
      <div className="flex flex-col border-b border-border" style={{ height: "35%" }}>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="SELECT * FROM …"
          className="flex-1 resize-none bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-2">
          <Button
            size="sm"
            onClick={runQuery}
            disabled={!query.trim() || runState === "running"}
            className="h-7 gap-1.5 px-3 text-xs"
          >
            {runState === "running"
              ? <Loader2 className="size-3 animate-spin" />
              : <Play className="size-3" />
            }
            Run
          </Button>
          <span className="text-xs text-muted-foreground">⌘ Enter</span>
          {statusText && (
            <span className="ml-auto text-xs text-muted-foreground">{statusText}</span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {runState === "error" && (
          <div className="p-4">
            <p className="rounded-md bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">{error}</p>
          </div>
        )}

        {result && result.columns.length === 0 && runState === "done" && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {result.rows_affected} row{result.rows_affected !== 1 ? "s" : ""} affected · {result.duration_ms}ms
            </p>
          </div>
        )}

        {result && result.columns.length > 0 && (
          <ResultsTable columns={result.columns} rows={result.rows} />
        )}

        {runState === "idle" && !result && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Run a query to see results</p>
          </div>
        )}
      </div>

      {warning && (
        <ConfirmDialog
          title={warning.title}
          message={warning.message}
          query={query}
          onConfirm={() => { setWarning(null); executeNow() }}
          onCancel={() => setWarning(null)}
        />
      )}
    </div>
  )
}

// ── Results table ─────────────────────────────────────────────────────────────

interface ResultsTableProps {
  columns: string[]
  rows: (string | number | boolean | null)[][]
}

function ResultsTable({ columns, rows }: ResultsTableProps) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-1.5 font-mono text-xs whitespace-nowrap ${
                    cell === null
                      ? "text-muted-foreground/50 italic"
                      : typeof cell === "number"
                        ? "text-right text-blue-400"
                        : typeof cell === "boolean"
                          ? cell ? "text-green-400" : "text-red-400"
                          : "text-foreground"
                  }`}
                >
                  {cell === null ? "NULL" : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
