import { X } from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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


function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground first:mt-0">
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
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px]" />

      <div
        className="animate-in fade-in-0 zoom-in-95 duration-200 ease-out relative z-10 w-full max-w-xs rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-sm font-medium text-foreground">Settings</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="text-muted-foreground" />
          </Button>
        </div>

        <div className="px-5 pb-5 pt-4">
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
              <Switch checked={confirmOnDelete} onCheckedChange={setConfirmOnDelete} />
            </Row>
            <Row label="Confirm DROP" description="Prompt before running DROP statements">
              <Switch checked={confirmOnDrop} onCheckedChange={setConfirmOnDrop} />
            </Row>
            <Row label="Confirm TRUNCATE" description="Prompt before truncating a table">
              <Switch checked={confirmOnTruncate} onCheckedChange={setConfirmOnTruncate} />
            </Row>
            <Row
              label="Confirm UPDATE without WHERE"
              description="Prompt when UPDATE has no WHERE clause"
            >
              <Switch checked={confirmOnUpdateWithoutWhere} onCheckedChange={setConfirmOnUpdateWithoutWhere} />
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
