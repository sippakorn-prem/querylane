import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  title: string
  message: string
  query: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, query, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onCancel])

  // Truncate long queries for display
  const preview = query.length > 200 ? query.slice(0, 200).trimEnd() + "…" : query

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="animate-in fade-in-0 zoom-in-95 duration-150 mx-4 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="size-4 text-red-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">{title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        {/* Query preview */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs text-muted-foreground">Query</p>
          <pre className="overflow-x-auto rounded-md bg-background px-3 py-2.5 font-mono text-xs text-foreground whitespace-pre-wrap break-words">
            {preview}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
          >
            Run anyway
          </Button>
        </div>
      </div>
    </div>
  )
}
