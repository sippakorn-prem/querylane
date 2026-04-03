import { X } from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import { Button } from "@/components/ui/button"
import type { Theme } from "@/store/settings"

interface SettingsModalProps {
  onClose: () => void
}

interface RowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function Row({ label, description, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-8 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      {children}
    </div>
  )
}

interface SegmentedControlProps<T extends string | number> {
  value: T
  options: { label: string; value: T }[]
  onChange: (value: T) => void
}

function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex rounded-md border border-border bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors select-none ${
            value === opt.value
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface ToggleProps {
  value: boolean
  onChange: (value: boolean) => void
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-5 w-9 cursor-pointer rounded-full border transition-colors ${
        value
          ? "border-foreground/20 bg-foreground/90"
          : "border-border bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-3.5 rounded-full transition-transform ${
          value
            ? "translate-x-4 bg-background"
            : "translate-x-0.5 bg-muted-foreground"
        }`}
      />
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-5 text-xs font-medium tracking-wider uppercase text-muted-foreground first:mt-0">
      {children}
    </p>
  )
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    theme, setTheme,
    confirmOnDelete, setConfirmOnDelete,
    confirmOnDrop, setConfirmOnDrop,
    confirmOnTruncate, setConfirmOnTruncate,
    confirmOnUpdateWithoutWhere, setConfirmOnUpdateWithoutWhere,
  } = useSettingsStore()

  return (
    <div
      className="animate-in fade-in-0 duration-200 fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/60" />

      <div
        className="animate-in fade-in-0 zoom-in-95 duration-200 ease-out relative z-10 w-full max-w-sm rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-sm font-medium text-foreground">Settings</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="text-muted-foreground" />
          </Button>
        </div>

        <div className="px-5 pb-5">
          <SectionLabel>Appearance</SectionLabel>
          <div className="divide-y divide-border">
            <Row label="Theme">
              <SegmentedControl<Theme>
                value={theme}
                options={[
                  { label: "Dark", value: "dark" },
                  { label: "Light", value: "light" },
                  { label: "System", value: "system" },
                ]}
                onChange={setTheme}
              />
            </Row>
          </div>

          <SectionLabel>Safety</SectionLabel>
          <div className="divide-y divide-border">
            <Row label="Confirm DELETE" description="Prompt before running DELETE queries">
              <Toggle value={confirmOnDelete} onChange={setConfirmOnDelete} />
            </Row>
            <Row label="Confirm DROP" description="Prompt before running DROP statements">
              <Toggle value={confirmOnDrop} onChange={setConfirmOnDrop} />
            </Row>
            <Row label="Confirm TRUNCATE" description="Prompt before truncating a table">
              <Toggle value={confirmOnTruncate} onChange={setConfirmOnTruncate} />
            </Row>
            <Row
              label="Confirm UPDATE without WHERE"
              description="Prompt when UPDATE has no WHERE clause"
            >
              <Toggle
                value={confirmOnUpdateWithoutWhere}
                onChange={setConfirmOnUpdateWithoutWhere}
              />
            </Row>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">Querylane v0.1.0</p>
        </div>
      </div>
    </div>
  )
}
