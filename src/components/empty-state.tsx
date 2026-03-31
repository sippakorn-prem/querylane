import { Database, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  onAddConnection?: () => void
}

export function EmptyState({ onAddConnection }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card">
        <Database className="size-5 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">No connections yet</p>
        <p className="text-xs text-muted-foreground">
          Connect to a database to get started
        </p>
      </div>

      <Button onClick={onAddConnection}>
        <Plus />
        Add connection
      </Button>
    </div>
  )
}
