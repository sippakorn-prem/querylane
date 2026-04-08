import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Clock, Copy, Download, Loader2, Play, WrapText } from "lucide-react"
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
import { useHistoryStore } from "@/store/history"

// ── CodeMirror themes ─────────────────────────────────────────────────────────
const querylaneDarkTheme = createTheme({
  theme: "dark",
  settings: {
    background: "#0d0d10",
    foreground: "#e4e4e7",
    caret: "#a1a1aa",
    selection: "#ffffff18",
    selectionMatch: "#ffffff0d",
    lineHighlight: "#ffffff03",
    gutterBackground: "#0d0d10",
    gutterForeground: "#3f3f46",
  },
  styles: [
    { tag: t.keyword,                color: "#a78bfa", fontWeight: "500" },
    { tag: t.operator,               color: "#a78bfa" },
    { tag: t.string,                 color: "#86efac" },
    { tag: t.number,                 color: "#fb923c" },
    { tag: t.bool,                   color: "#a78bfa" },
    { tag: t.null,                   color: "#71717a", fontStyle: "italic" },
    { tag: t.comment,                color: "#52525b", fontStyle: "italic" },
    { tag: t.name,                   color: "#e4e4e7" },
    { tag: t.typeName,               color: "#67e8f9" },
    { tag: t.variableName,           color: "#e4e4e7" },
    { tag: t.special(t.variableName), color: "#93c5fd" },
    { tag: t.punctuation,            color: "#71717a" },
    { tag: t.bracket,                color: "#71717a" },
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
  runTrigger?: number
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

export function QueryEditor({ connection, activeDatabase, query, onQueryChange, runTrigger }: Props) {
  const [runState, setRunState] = useState<RunState>("idle")
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState<DestructiveWarning | null>(null)
  const [prodPending, setProdPending] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const baseSqlRef = useRef("")  // user's query with LIMIT/OFFSET stripped

  const [historyOpen, setHistoryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const historyPanelRef = useRef<HTMLDivElement>(null)
  const exportPanelRef = useRef<HTMLDivElement>(null)

  const { add: historyAdd, clear: historyClear, entries: historyEntries } = useHistoryStore()
  const connectionHistory = historyEntries.filter((e) => e.connectionId === connection.id)
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

  // Close history / export dropdowns on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (historyPanelRef.current && !historyPanelRef.current.contains(e.target as Node)) setHistoryOpen(false)
      if (exportPanelRef.current && !exportPanelRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

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

  const connParams = {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    db_type: connection.db_type,
    database: activeDatabase || connection.database,
  }

  // Strip LIMIT / OFFSET from a SQL string so we can add our own
  function stripLimitOffset(sql: string): string {
    return sql
      .replace(/\s+LIMIT\s+\d+(\s*,\s*\d+)?(\s+OFFSET\s+\d+)?/gi, "")
      .replace(/\s+OFFSET\s+\d+/gi, "")
      .trim()
      .replace(/;$/, "")
      .trim()
  }

  async function executeNow(q: string, onDone?: (res: QueryResult) => void) {
    setRunState("running")
    setResult(null)
    setError("")
    try {
      const res = await connectionsApi.executeQuery({ ...connParams, query: q })
      setResult(res)
      setRunState("done")
      onDone?.(res)
    } catch (e) {
      setError(String(e))
      setRunState("error")
    }
  }

  function executePage(base: string, targetPage: number, targetPageSize: number, onDone?: (res: QueryResult) => void) {
    const offset = (targetPage - 1) * targetPageSize
    executeNow(`${base}\nLIMIT ${targetPageSize} OFFSET ${offset}`, onDone)
  }

  async function fetchCount(base: string) {
    setCountLoading(true)
    setTotalCount(null)
    try {
      // Strip ORDER BY too — not needed for counting and can break subquery in some engines
      const noOrder = base.replace(/\s+ORDER\s+BY\s+[\s\S]+?(?=\s+LIMIT\b|\s+OFFSET\b|;?\s*$)/i, "").trimEnd()
      const countSql = `SELECT COUNT(*) FROM (\n${noOrder}\n) _querylane_count`
      const res = await connectionsApi.executeQuery({ ...connParams, query: countSql })
      if (res.rows.length > 0 && res.rows[0].length > 0) {
        const raw = res.rows[0][0]
        const n = typeof raw === "number" ? raw : parseInt(String(raw), 10)
        setTotalCount(isNaN(n) ? null : n)
      }
    } catch {
      setTotalCount(null)
    } finally {
      setCountLoading(false)
    }
  }

  function startQuery(base: string) {
    baseSqlRef.current = base
    setPage(1)
    setTotalCount(null)
    executePage(base, 1, pageSize, (res) => {
      historyAdd({
        query: base,
        connectionId: connection.id,
        connectionName: connection.name,
        executedAt: Date.now(),
        duration_ms: res.duration_ms,
        rowCount: res.rows_affected,
      })
    })
    fetchCount(base)
  }

  function runQuery() {
    if (!query.trim() || runState === "running") return
    if (connection.environment === "prod") {
      setProdPending(true)
      return
    }
    const w = detectDestructive(query)
    if (w) { setWarning(w); return }
    startQuery(stripLimitOffset(query))
  }

  // Auto-execute when a table is selected from the schema sidebar (bypasses prod/destructive checks)
  useEffect(() => {
    if (runTrigger && runTrigger > 0) startQuery(stripLimitOffset(query))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTrigger])

  function handleSort(col: string) {
    if (runState === "running") return
    const nextDir = sortCol === col && sortDir === "asc" ? "desc" : "asc"
    setSortCol(col)
    setSortDir(nextDir)
    const newQuery = injectOrderBy(query, col, nextDir)
    prevQueryRef.current = newQuery  // don't reset sort from the echo
    onQueryChange(newQuery)
    // Sorting goes back to page 1 but doesn't change the count
    const newBase = stripLimitOffset(newQuery)
    baseSqlRef.current = newBase
    setPage(1)
    executePage(newBase, 1, pageSize)
  }

  // ── Export helpers ────────────────────────────────────────────────────────────

  type CellValue = string | number | boolean | null

  function toCsv(columns: string[], rows: CellValue[][]): string {
    function esc(v: CellValue): string {
      if (v === null) return ""
      const s = String(v)
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")
  }

  function toJson(columns: string[], rows: CellValue[][]): string {
    return JSON.stringify(
      rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]]))),
      null,
      2
    )
  }

  function triggerDownload(content: string, filename: string, mime: string) {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([content], { type: mime })),
      download: filename,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1200)
  }

  async function exportAllRows(format: "csv" | "json") {
    if (!baseSqlRef.current) return
    setExportLoading(true)
    setExportOpen(false)
    try {
      const res = await connectionsApi.executeQuery({ ...connParams, query: baseSqlRef.current })
      const name = `${connection.name}-export`
      if (format === "csv") triggerDownload(toCsv(res.columns, res.rows), `${name}.csv`, "text/csv")
      else triggerDownload(toJson(res.columns, res.rows), `${name}.json`, "application/json")
    } finally {
      setExportLoading(false)
    }
  }

  function timeAgo(ts: number): string {
    const d = Date.now() - ts
    if (d < 60_000) return "just now"
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
    return `${Math.floor(d / 86_400_000)}d ago`
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
          <div className="mx-1 h-3.5 w-px bg-border" />

          {/* History */}
          <div className="relative" ref={historyPanelRef}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setHistoryOpen((o) => !o)}
              className={`h-7 gap-1.5 px-2 text-xs ${historyOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Clock className="size-3" />
              History
            </Button>
            {historyOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[420px] overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent queries</span>
                  {connectionHistory.length > 0 && (
                    <button
                      onClick={historyClear}
                      className="cursor-pointer text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {connectionHistory.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No history yet</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {connectionHistory.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => { onQueryChange(entry.query); setHistoryOpen(false) }}
                        className="w-full cursor-pointer border-b border-border/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 last:border-0"
                      >
                        <p className="truncate font-mono text-xs text-foreground">{entry.query}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {timeAgo(entry.executedAt)} · {entry.duration_ms}ms · {entry.rowCount.toLocaleString()} rows
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Results</span>
            <div className="relative" ref={exportPanelRef}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExportOpen((o) => !o)}
                disabled={exportLoading}
                className="h-6 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {exportLoading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                Export
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                  {[
                    { key: "copy-csv", label: "Copy CSV", icon: Copy, action: () => { if (result) { copyText(toCsv(result.columns, result.rows), "copy-csv"); setExportOpen(false) } } },
                    { key: "copy-json", label: "Copy JSON", icon: Copy, action: () => { if (result) { copyText(toJson(result.columns, result.rows), "copy-json"); setExportOpen(false) } } },
                    { key: "save-csv", label: "Save all as CSV", icon: Download, action: () => exportAllRows("csv") },
                    { key: "save-json", label: "Save all as JSON", icon: Download, action: () => exportAllRows("json") },
                  ].map(({ key, label, icon: Icon, action }) => (
                    <button
                      key={key}
                      onClick={action}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted/50"
                    >
                      {copiedKey === key ? <Check className="size-3 text-emerald-400" /> : <Icon className="size-3 text-muted-foreground" />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {result && result.columns.length > 0 && (
          <ResultsTable
            columns={result.columns}
            rows={result.rows}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            countLoading={countLoading}
            onPageChange={(p) => {
              setPage(p)
              executePage(baseSqlRef.current, p, pageSize)
            }}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
              executePage(baseSqlRef.current, 1, size)
            }}
          />
        )}

        {runState === "idle" && !result && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Run a query to see results</p>
          </div>
        )}
      </div>

      {prodPending && (
        <ConfirmDialog
          variant="prod"
          title="Running on production"
          message="This connection is marked as production. Double-check your query before proceeding."
          query={query}
          onConfirm={() => {
            setProdPending(false)
            const w = detectDestructive(query)
            if (w) { setWarning(w); return }
            startQuery(stripLimitOffset(query))
          }}
          onCancel={() => setProdPending(false)}
        />
      )}

      {warning && (
        <ConfirmDialog
          title={warning.title}
          message={warning.message}
          query={query}
          onConfirm={() => { setWarning(null); startQuery(stripLimitOffset(query)) }}
          onCancel={() => setWarning(null)}
        />
      )}
    </div>
  )
}

// ── Results table ─────────────────────────────────────────────────────────────

const MAX_CELL_LEN = 120
const PAGE_SIZE_OPTIONS = [25, 50, 100, 500]

interface ResultsTableProps {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  sortCol: string | null
  sortDir: "asc" | "desc"
  onSort: (col: string) => void
  page: number
  pageSize: number
  totalCount: number | null
  countLoading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function ResultsTable({ columns, rows, sortCol, sortDir, onSort, page, pageSize, totalCount, countLoading, onPageChange, onPageSizeChange }: ResultsTableProps) {
  const [copiedCell, setCopiedCell] = useState<string | null>(null)

  const offset = (page - 1) * pageSize
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null

  function copyCell(value: string | number | boolean | null, key: string) {
    navigator.clipboard.writeText(value === null ? "" : String(value))
    setCopiedCell(key)
    setTimeout(() => setCopiedCell(null), 800)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
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
            {rows.map((row, ri) => {
              const absIndex = offset + ri
              return (
                <tr
                  key={absIndex}
                  className={`border-b border-border/40 hover:bg-muted/25 transition-colors ${
                    absIndex % 2 === 1 ? "bg-muted/[0.04]" : ""
                  }`}
                >
                  {/* Absolute row number */}
                  <td className="sticky left-0 bg-background px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground/30 border-r border-border/40 select-none tabular-nums">
                    {absIndex + 1}
                  </td>
                  {row.map((cell, ci) => {
                    const key = `${absIndex}-${ci}`
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
                          isCopied ? "bg-zinc-500/15 text-zinc-300" :
                          isNull ? "text-muted-foreground/25" :
                          isNum ? "text-right text-violet-400 dark:text-violet-400" :
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
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Rows per page</span>
          <div className="flex rounded border border-border overflow-hidden">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => onPageSizeChange(size)}
                className={`px-2 py-0.5 text-[11px] transition-colors cursor-pointer select-none ${
                  pageSize === size
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Total count from COUNT(*) query */}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {countLoading
              ? <span className="animate-pulse">counting…</span>
              : totalCount != null
                ? <>{offset + 1}–{Math.min(offset + rows.length, totalCount)} <span className="text-muted-foreground/50">of</span> {totalCount.toLocaleString()}</>
                : rows.length > 0
                  ? <>{offset + 1}–{offset + rows.length}</>
                  : "0"
            }
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="flex size-6 items-center justify-center rounded transition-colors cursor-pointer disabled:cursor-default disabled:opacity-30 hover:bg-muted"
            >
              <ChevronLeft className="size-3.5 text-muted-foreground" />
            </button>
            <span className="min-w-[3rem] text-center text-[11px] text-muted-foreground tabular-nums">
              {page}{totalPages != null ? ` / ${totalPages}` : ""}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={totalPages != null ? page >= totalPages : rows.length < pageSize}
              className="flex size-6 items-center justify-center rounded transition-colors cursor-pointer disabled:cursor-default disabled:opacity-30 hover:bg-muted"
            >
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
