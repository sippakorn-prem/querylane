import { Database, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  onAddConnection?: () => void
}

export function EmptyState({ onAddConnection }: EmptyStateProps) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-400 ease-out w-full max-w-sm rounded-xl border border-border bg-card p-10 shadow-sm">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/50">
          <Database className="size-5 text-muted-foreground" />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">No connections yet</p>
          <p className="text-xs text-muted-foreground">
            Connect to a Postgres or MySQL database to get started
          </p>
        </div>

        <Button size="lg" onClick={onAddConnection}>
          <Plus />
          Add connection
        </Button>
      </div>
    </div>
  )
}
