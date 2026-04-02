import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { connectionsApi, type ConnectionConfig, type Environment } from "@/lib/connections"
import { useConnectionsStore } from "@/store/connections"

interface ConnectionPanelProps {
  editing?: ConnectionConfig
  onClose: () => void
}

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

type TestState = "idle" | "testing" | "ok" | "error"

export function ConnectionPanel({ editing, onClose }: ConnectionPanelProps) {
  const { add, update } = useConnectionsStore()

  const [name, setName] = useState(editing?.name ?? "")
  const [host, setHost] = useState(editing?.host ?? "localhost")
  const [port, setPort] = useState(String(editing?.port ?? 5432))
  const [database, setDatabase] = useState(editing?.database ?? "")
  const [username, setUsername] = useState(editing?.username ?? "")
  const [password, setPassword] = useState(editing?.password ?? "")
  const [environment, setEnvironment] = useState<Environment>(editing?.environment ?? "dev")
  const [testState, setTestState] = useState<TestState>("idle")
  const [testError, setTestError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function handleTest() {
    setTestState("testing")
    setTestError("")
    try {
      await connectionsApi.test({ host, port: Number(port), database, username, password })
      setTestState("ok")
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
          name, host, port: Number(port), database, username, password, environment,
        }
        await connectionsApi.update(updated)
        update(updated)
      } else {
        const created = await connectionsApi.create({
          name, host, port: Number(port), database, username, password, environment,
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

  const isValid = name && host && port && database && username

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
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

        <Field label="Host">
          <Input value={host} onChange={setHost} placeholder="localhost" />
        </Field>

        <div className="flex gap-2">
          <Field label="Port" className="w-24 shrink-0">
            <Input value={port} onChange={setPort} placeholder="5432" type="number" />
          </Field>
          <Field label="Database" className="flex-1">
            <Input value={database} onChange={setDatabase} placeholder="mydb" />
          </Field>
        </div>

        <Field label="Username">
          <Input value={username} onChange={setUsername} placeholder="postgres" />
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

        {testState === "error" && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{testError}</p>
        )}
        {testState === "ok" && (
          <p className="rounded-md bg-green-500/10 px-3 py-2 text-xs text-green-500">
            Connection successful
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={!isValid || testState === "testing"}
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
