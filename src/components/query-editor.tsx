import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Play, WrapText } from "lucide-react"
import { format as formatSql } from "sql-formatter"
import CodeMirror, { keymap } from "@uiw/react-codemirror"
import { sql, PostgreSQL, MySQL } from "@codemirror/lang-sql"
import { createTheme } from "@uiw/codemirror-themes"
import { tags as t } from "@lezer/highlight"
import { Compartment, Prec } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { connectionsApi, type ConnectionConfig, type QueryResult } from "@/lib/connections"
import { detectDestructive, type DestructiveWarning } from "@/lib/query-safety"
import { useSettingsStore } from "@/store/settings"

// ── CodeMirror themes ─────────────────────────────────────────────────────────
const querylaneDarkTheme = createTheme({
  theme: "dark",
  settings: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    caret: "#7eb8f7",
    selection: "#7eb8f72a",
    selectionMatch: "#7eb8f710",
    lineHighlight: "#ffffff03",
    gutterBackground: "#0d1117",
    gutterForeground: "#3a4048",
  },
  styles: [
    { tag: t.keyword,                color: "#7eb8f7", fontWeight: "500" },
    { tag: t.operator,               color: "#7eb8f7" },
    { tag: t.string,                 color: "#98c379" },
    { tag: t.number,                 color: "#d19a66" },
    { tag: t.bool,                   color: "#d19a66" },
    { tag: t.null,                   color: "#868e96", fontStyle: "italic" },
    { tag: t.comment,                color: "#495057", fontStyle: "italic" },
    { tag: t.name,                   color: "#F8F9FA" },
    { tag: t.typeName,               color: "#c678dd" },
    { tag: t.variableName,           color: "#F8F9FA" },
    { tag: t.special(t.variableName), color: "#e06c75" },
    { tag: t.punctuation,            color: "#868e96" },
    { tag: t.bracket,                color: "#868e96" },
  ],
})

const querylaneLightTheme = createTheme({
  theme: "light",
  settings: {
    background: "transparent",
    foreground: "#1f2328",
    caret: "#0550ae",
    selection: "#0550ae22",
    selectionMatch: "#0550ae10",
    lineHighlight: "#00000005",
    gutterBackground: "transparent",
    gutterForeground: "#8c959f",
  },
  styles: [
    { tag: t.keyword,                color: "#0550ae", fontWeight: "500" },
    { tag: t.operator,               color: "#0550ae" },
    { tag: t.string,                 color: "#116329" },
    { tag: t.number,                 color: "#953800" },
    { tag: t.bool,                   color: "#953800" },
    { tag: t.null,                   color: "#8c959f", fontStyle: "italic" },
    { tag: t.comment,                color: "#6e7781", fontStyle: "italic" },
    { tag: t.name,                   color: "#1f2328" },
    { tag: t.typeName,               color: "#8250df" },
    { tag: t.variableName,           color: "#1f2328" },
    { tag: t.special(t.variableName), color: "#cf222e" },
    { tag: t.punctuation,            color: "#6e7781" },
    { tag: t.bracket,                color: "#6e7781" },
  ],
})

interface Props {
  connection: ConnectionConfig
  activeDatabase: string
  query: string
  onQueryChange: (q: string) => void
}

type RunState = "idle" | "running" | "done" | "error"

// Strips any existing ORDER BY and inserts a new one before LIMIT/OFFSET or at end.
function injectOrderBy(query: string, col: string, dir: "asc" | "desc"): string {
  const orderBy = `ORDER BY "${col}" ${dir.toUpperCase()}`
  // Remove existing ORDER BY (stops at LIMIT, OFFSET, semicolon, or end)
  const stripped = query
    .replace(/\s+ORDER\s+BY\s+[\s\S]+?(?=\s+LIMIT\b|\s+OFFSET\b|;?\s*$)/i, "")
    .trimEnd()
    .replace(/;?\s*$/, "")

  const limitMatch = stripped.search(/\b(LIMIT|OFFSET)\b/i)
  if (limitMatch !== -1) {
    return stripped.slice(0, limitMatch).trimEnd() + ` ${orderBy} ` + stripped.slice(limitMatch)
  }
  return stripped + ` ${orderBy}`
}

export function QueryEditor({ connection, activeDatabase, query, onQueryChange }: Props) {
  const [runState, setRunState] = useState<RunState>("idle")
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState<DestructiveWarning | null>(null)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const dialect = connection.db_type === "mysql" ? "mysql" : "postgresql"
  const sqlDialect = connection.db_type === "mysql" ? MySQL : PostgreSQL

  const { theme } = useSettingsStore()
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  const isDark = theme === "dark" || (theme === "system" && systemDark)
  const editorTheme = isDark ? querylaneDarkTheme : querylaneLightTheme

  // Compartment lets us reconfigure the sql() extension after the editor mounts
  const sqlCompartment = useRef(new Compartment())
  const editorViewRef = useRef<EditorView | null>(null)

  // Fetch real schema whenever the active database changes, then push into editor
  useEffect(() => {
    if (!activeDatabase) return
    connectionsApi.getSchema({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      db_type: connection.db_type,
      database: activeDatabase,
    }).then((schema) => {
      editorViewRef.current?.dispatch({
        effects: sqlCompartment.current.reconfigure(
          sql({ dialect: sqlDialect, schema, upperCaseKeywords: true })
        ),
      })
    }).catch(() => {})
  }, [activeDatabase, connection.host, connection.port, connection.username, connection.db_type, sqlDialect])

  function formatQuery() {
    if (!query.trim()) return
    try {
      const formatted = formatSql(query, {
        language: dialect,
        tabWidth: 2,
        keywordCase: "upper",
        identifierCase: "preserve",
        dataTypeCase: "upper",
        functionCase: "upper",
      })
      onQueryChange(formatted)
    } catch {
      // leave as-is if formatter chokes on it
    }
  }

  // Reset sort when query changes manually (user edits the editor)
  const prevQueryRef = useRef(query)
  useEffect(() => {
    if (query !== prevQueryRef.current) {
      setSortCol(null)
      prevQueryRef.current = query
    }
  }, [query])

  async function executeNow(q = query) {
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
        query: q,
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
    if (w) { setWarning(w); return }
    executeNow()
  }

  function handleSort(col: string) {
    if (runState === "running") return
    const nextDir = sortCol === col && sortDir === "asc" ? "desc" : "asc"
    setSortCol(col)
    setSortDir(nextDir)
    const newQuery = injectOrderBy(query, col, nextDir)
    prevQueryRef.current = newQuery  // don't reset sort from the echo
    onQueryChange(newQuery)
    executeNow(newQuery)
  }

  // Stable refs so keymap callbacks always call the latest function
  const runQueryRef = useRef(runQuery)
  const formatQueryRef = useRef(formatQuery)
  useEffect(() => { runQueryRef.current = runQuery })
  useEffect(() => { formatQueryRef.current = formatQuery })

  // Keymaps are created once — refs ensure they're never stale
  const editorKeymaps = useMemo(() => Prec.highest(
    keymap.of([
      { key: "Mod-Enter", run: () => { runQueryRef.current(); return true } },
      { key: "Mod-Shift-f", run: () => { formatQueryRef.current(); return true } },
    ])
  ), [])

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
      <div className="flex flex-col border-b border-border bg-card" style={{ height: "35%" }}>
        <CodeMirror
          value={query}
          onChange={onQueryChange}
          onCreateEditor={(view) => { editorViewRef.current = view }}
          theme={editorTheme}
          extensions={[
            sqlCompartment.current.of(sql({ dialect: sqlDialect, upperCaseKeywords: true })),
            editorKeymaps,
          ]}
          autoFocus
          placeholder="SELECT * FROM …"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            indentOnInput: true,
          }}
          className="flex-1 overflow-auto text-sm"
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        />

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-2 shadow-[0_-1px_0_0] shadow-border/40">
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
          <span className="text-[11px] text-muted-foreground/60">⌘ Enter</span>
          <div className="mx-1 h-3.5 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            onClick={formatQuery}
            disabled={!query.trim()}
            title="Format SQL (⌘⇧F)"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <WrapText className="size-3" />
            Format
          </Button>
          {statusText && (
            <span className="ml-auto text-[11px] text-muted-foreground">{statusText}</span>
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
          <ResultsTable
            columns={result.columns}
            rows={result.rows}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
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

const MAX_CELL_LEN = 120

interface ResultsTableProps {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  sortCol: string | null
  sortDir: "asc" | "desc"
  onSort: (col: string) => void
}

function ResultsTable({ columns, rows, sortCol, sortDir, onSort }: ResultsTableProps) {
  const [copiedCell, setCopiedCell] = useState<string | null>(null)

  function copyCell(value: string | number | boolean | null, key: string) {
    navigator.clipboard.writeText(value === null ? "" : String(value))
    setCopiedCell(key)
    setTimeout(() => setCopiedCell(null), 800)
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="text-sm border-collapse">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            {/* Row # */}
            <th className="sticky left-0 z-20 bg-muted/30 w-10 px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/40 border-r border-border select-none">
              #
            </th>
            {columns.map((col) => {
              const active = sortCol === col
              const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown
              return (
                <th
                  key={col}
                  onClick={() => onSort(col)}
                  className="bg-muted/30 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground hover:bg-muted/50 select-none transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {col}
                    <Icon className={`size-3 shrink-0 ${active ? "text-foreground" : "text-muted-foreground/25"}`} />
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-border/40 hover:bg-muted/25 transition-colors ${
                ri % 2 === 1 ? "bg-muted/[0.04]" : ""
              }`}
            >
              {/* Row number */}
              <td className="sticky left-0 bg-background px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground/30 border-r border-border/40 select-none tabular-nums">
                {ri + 1}
              </td>
              {row.map((cell, ci) => {
                const key = `${ri}-${ci}`
                const isCopied = copiedCell === key
                const isNum = typeof cell === "number"
                const isBool = typeof cell === "boolean"
                const isNull = cell === null
                const raw = isNull ? "" : String(cell)
                const display = raw.length > MAX_CELL_LEN ? raw.slice(0, MAX_CELL_LEN) + "…" : raw

                return (
                  <td
                    key={ci}
                    onClick={() => copyCell(cell, key)}
                    title={!isNull && raw.length > MAX_CELL_LEN ? raw : undefined}
                    className={[
                      "px-3 py-1.5 font-mono text-xs whitespace-nowrap cursor-pointer transition-colors",
                      isCopied ? "bg-blue-500/15 text-blue-300" :
                      isNull ? "text-muted-foreground/25" :
                      isNum ? "text-right text-[#7eb8f7]" :
                      isBool ? (cell ? "text-emerald-400" : "text-red-400") :
                      "text-foreground",
                    ].join(" ")}
                  >
                    {isNull
                      ? <span className="text-[10px] italic tracking-wide">null</span>
                      : display
                    }
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
