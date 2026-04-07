import { useState, useRef, useEffect, type RefObject } from "react"
import { X, Loader2, Database, ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { connectionsApi, type ConnectionConfig, type DbType, type Environment } from "@/lib/connections"
import { useConnectionsStore } from "@/store/connections"

interface ConnectionPanelProps {
  editing?: ConnectionConfig
  onClose: () => void
}

// ── DB type icons ─────────────────────────────────────────────────────────────

function PostgresIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="10" rx="9" ry="9" fill="#336791" />
      <ellipse cx="22" cy="8" rx="3" ry="4.5" fill="#336791" stroke="#fff" strokeWidth="1" />
      <path d="M7 10 C7 10 6 22 10 25 C12 27 14 27 16 26 C18 27 20 27 22 25 C26 22 25 10 25 10" fill="#336791" />
      <ellipse cx="16" cy="10" rx="8" ry="8" fill="#4a90d9" />
      <ellipse cx="22" cy="8" rx="2.5" ry="3.5" fill="#4a90d9" stroke="#336791" strokeWidth="0.8" />
      <path d="M8 18 C8 18 7.5 26 10.5 28 C12.5 29.5 15 29 16 28.5 C17 29 19.5 29.5 21.5 28 C24.5 26 24 18 24 18" fill="#4a90d9" stroke="#336791" strokeWidth="0.8" />
      <path d="M13 13 Q16 16 19 13" stroke="#336791" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="13" cy="11" r="1.2" fill="#336791" />
      <circle cx="19" cy="11" r="1.2" fill="#336791" />
    </svg>
  )
}

function MySQLIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20 C4 20 6 8 16 8 C26 8 28 20 28 20" stroke="#e48c00" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M16 8 C16 8 20 4 26 6 C28 7 29 9 28 11 C27 9 25 8 23 9 C21 10 20 12 20 14" stroke="#00758f" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="16" cy="22" rx="10" ry="6" fill="#e48c00" />
      <ellipse cx="16" cy="21" rx="9" ry="5" fill="#f5a623" />
      <text x="16" y="23.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#a05a00" fontFamily="sans-serif">SQL</text>
    </svg>
  )
}

const DB_TYPES: { label: string; value: DbType; defaultPort: number; description: string }[] = [
  { label: "PostgreSQL", value: "postgres", defaultPort: 5432, description: "Port 5432" },
  { label: "MySQL", value: "mysql", defaultPort: 3306, description: "Port 3306" },
]

const ENV_OPTIONS: { label: string; value: Environment }[] = [
  { label: "Dev", value: "dev" },
  { label: "Staging", value: "staging" },
  { label: "Prod", value: "prod" },
]

const ENV_COLORS: Record<Environment, string> = {
  dev: "text-green-500 border-green-500 bg-green-500/10",
  staging: "text-yellow-500 border-yellow-500 bg-yellow-500/10",
  prod: "text-red-500 border-red-500 bg-red-500/10",
}

function useClickOutside(ref: RefObject<HTMLDivElement | null>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen, ref, onClose])
}

type TestState = "idle" | "testing" | "ok" | "error"
type BrowseState = "idle" | "loading" | "error"

export function ConnectionPanel({ editing, onClose }: ConnectionPanelProps) {
  const { add, update } = useConnectionsStore()

  const [name, setName] = useState(editing?.name ?? "")
  const [dbType, setDbType] = useState<DbType>(editing?.db_type ?? "postgres")
  const [host, setHost] = useState(editing?.host ?? "localhost")
  const [port, setPort] = useState(String(editing?.port ?? 5432))
  const [database, setDatabase] = useState(editing?.database ?? "")
  const [username, setUsername] = useState(editing?.username ?? "")
  const [password, setPassword] = useState(editing?.password ?? "")
  const [environment, setEnvironment] = useState<Environment>(editing?.environment ?? "dev")
  const [testState, setTestState] = useState<TestState>("idle")
  const [testError, setTestError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [browseState, setBrowseState] = useState<BrowseState>("idle")
  const [browseError, setBrowseError] = useState("")
  const [databases, setDatabases] = useState<string[]>([])
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false)
  const dbDropdownRef = useRef<HTMLDivElement>(null)
  const [dbPickerOpen, setDbPickerOpen] = useState(false)
  const dbPickerRef = useRef<HTMLDivElement>(null)

  useClickOutside(dbDropdownRef, dbDropdownOpen, () => setDbDropdownOpen(false))
  useClickOutside(dbPickerRef, dbPickerOpen, () => setDbPickerOpen(false))

  function handleDbTypeChange(type: DbType) {
    setDbType(type)
    const defaultPort = DB_TYPES.find((t) => t.value === type)?.defaultPort ?? 5432
    const currentDefault = DB_TYPES.find((t) => t.value === dbType)?.defaultPort ?? 5432
    if (port === String(currentDefault)) setPort(String(defaultPort))
  }

  async function handleBrowse() {
    setBrowseState("loading")
    setBrowseError("")
    setDbDropdownOpen(false)
    try {
      const dbs = await connectionsApi.listDatabases({ host, port: Number(port), username, password, db_type: dbType })
      setDatabases(dbs)
      setDbDropdownOpen(true)
      setBrowseState("idle")
    } catch (err) {
      setBrowseState("error")
      setBrowseError(String(err))
    }
  }

  const testDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (testDismissTimer.current) clearTimeout(testDismissTimer.current) }, [])

  async function handleTest() {
    if (testDismissTimer.current) clearTimeout(testDismissTimer.current)
    setTestState("testing")
    setTestError("")
    try {
      await connectionsApi.test({ host, port: Number(port), database, username, password, db_type: dbType })
      setTestState("ok")
      testDismissTimer.current = setTimeout(() => setTestState("idle"), 2500)
    } catch (err) {
      setTestState("error")
      setTestError(String(err))
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      if (editing) {
        const updated: ConnectionConfig = {
          ...editing,
          name, db_type: dbType, host, port: Number(port), database, username, password, environment,
        }
        await connectionsApi.update(updated)
        update(updated)
      } else {
        const created = await connectionsApi.create({
          name, db_type: dbType, host, port: Number(port), database, username, password, environment,
        })
        add(created)
      }
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const isValid = name && host && port && username
  const canTest = host && port && username
  const canBrowse = host && port && username && password

  return (
    <div className="animate-in slide-in-from-right-4 fade-in-0 duration-200 ease-out relative flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {editing ? "Edit connection" : "New connection"}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="text-muted-foreground" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Field label="Name">
          <Input value={name} onChange={setName} placeholder="My local DB" />
        </Field>

        <Field label="Database type">
          <div className="relative" ref={dbPickerRef}>
            <button
              onClick={() => setDbPickerOpen((v) => !v)}
              className="flex h-9 w-full items-center gap-2.5 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-ring/60 focus:outline-none"
            >
              {dbType === "postgres"
                ? <PostgresIcon className="size-5 shrink-0" />
                : <MySQLIcon className="size-5 shrink-0" />
              }
              <span className="flex-1 text-left">{DB_TYPES.find(d => d.value === dbType)?.label}</span>
              <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${dbPickerOpen ? "rotate-180" : ""}`} />
            </button>

            {dbPickerOpen && (
              <div className="animate-in fade-in-0 zoom-in-95 duration-150 ease-out absolute top-full left-0 z-30 mt-1.5 w-full rounded-lg border border-border bg-card p-2 shadow-xl">
                <div className="grid grid-cols-2 gap-2">
                  {DB_TYPES.map((opt) => {
                    const selected = dbType === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { handleDbTypeChange(opt.value); setDbPickerOpen(false) }}
                        className={`relative flex flex-col items-center gap-2 rounded-md border p-3 transition-colors cursor-pointer ${
                          selected
                            ? "border-ring bg-muted"
                            : "border-border hover:border-ring/50 hover:bg-muted/50"
                        }`}
                      >
                        {selected && (
                          <span className="absolute top-1.5 right-1.5">
                            <Check className="size-3 text-ring" />
                          </span>
                        )}
                        {opt.value === "postgres"
                          ? <PostgresIcon className="size-8" />
                          : <MySQLIcon className="size-8" />
                        }
                        <div className="text-center">
                          <p className="text-xs font-medium text-foreground">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Field>

        <Field label="Host">
          <Input value={host} onChange={setHost} placeholder="localhost" />
        </Field>

        <div className="flex gap-2">
          <Field label="Port" className="w-24 shrink-0">
            <Input value={port} onChange={setPort} placeholder="5432" type="number" />
          </Field>
          <Field label="Database" className="flex-1">
            <div className="relative" ref={dbDropdownRef}>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="optional"
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
                <button
                  onClick={handleBrowse}
                  disabled={!canBrowse || browseState === "loading"}
                  title="Browse available databases"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  {browseState === "loading"
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Database className="size-3.5" />
                  }
                </button>
              </div>

              {dbDropdownOpen && databases.length > 0 && (
                <div className="animate-in fade-in-0 zoom-in-95 duration-100 ease-out absolute top-full left-0 z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  <ul className="max-h-40 overflow-y-auto py-1">
                    {databases.map((db) => (
                      <li key={db}>
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                          onClick={() => { setDatabase(db); setDbDropdownOpen(false) }}
                        >
                          {db}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {browseState === "error" && (
              <p className="mt-1 text-xs text-red-400">{browseError}</p>
            )}
          </Field>
        </div>

        <Field label="Username">
          <Input value={username} onChange={setUsername} placeholder={dbType === "postgres" ? "postgres" : "root"} />
        </Field>

        <Field label="Password">
          <Input value={password} onChange={setPassword} placeholder="••••••••" type="password" />
        </Field>

        <Field label="Environment">
          <div className="flex gap-1.5">
            {ENV_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEnvironment(opt.value)}
                className={`cursor-pointer rounded-md border px-3 py-1 text-xs font-medium transition-colors select-none ${
                  environment === opt.value
                    ? ENV_COLORS[opt.value]
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

      </div>

      {(testState === "ok" || testState === "error") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[88px] flex justify-center px-4">
          <div className={`animate-in fade-in-0 slide-in-from-bottom-2 duration-200 pointer-events-auto w-full rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur-sm ${
            testState === "ok"
              ? "border-green-500/30 bg-green-500/15 text-green-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }`}>
            <p className="text-xs leading-snug">
              {testState === "ok" ? "Connection successful" : testError}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={!canTest || testState === "testing"}
        >
          {testState === "testing" && <Loader2 className="animate-spin" />}
          {testState === "testing" ? "Testing…" : "Test connection"}
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}

// ── Small internal components ─────────────────────────────────────────────────

interface FieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

function Field({ label, children, className }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}

function Input({ value, onChange, placeholder, type = "text" }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
    />
  )
}
