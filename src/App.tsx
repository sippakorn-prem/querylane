import { Settings } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

export default function App() {
  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground">
      <header
        className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4"
        data-tauri-drag-region
      >
        <span className="text-sm font-medium text-foreground">Querylane</span>
        <Button variant="ghost" size="icon-sm">
          <Settings className="text-muted-foreground" />
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <EmptyState />
      </main>
    </div>
  )
}
