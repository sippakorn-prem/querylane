import { useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { SchemaSidebar } from "@/components/schema-sidebar"
import { QueryEditor } from "@/components/query-editor"
import type { ConnectionConfig } from "@/lib/connections"

interface Tab {
  id: string
  label: string
  query: string
  activeDatabase: string
  runTrigger: number
}

interface Props {
  connection: ConnectionConfig
}

function makeTab(num: number, database: string): Tab {
  return {
    id: crypto.randomUUID(),
    label: `Query ${num}`,
    query: "SELECT 1",
    activeDatabase: database,
    runTrigger: 0,
  }
}

export function Workspace({ connection }: Props) {
  const tabCountRef = useRef(1)
  const defaultDb = connection.database ?? ""

  const [tabs, setTabs] = useState<Tab[]>([makeTab(1, defaultDb)])
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  function addTab() {
    tabCountRef.current += 1
    const tab = makeTab(tabCountRef.current, defaultDb)
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      if (id === activeTabId && next.length > 0) {
        setActiveTabId(next[Math.min(idx, next.length - 1)].id)
      }
      return next
    })
  }

  function handleTableSelect(database: string, table: string) {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              label: table,
              activeDatabase: database,
              query: `SELECT *\nFROM ${table}`,
              runTrigger: t.runTrigger + 1,
            }
          : t
      )
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Schema sidebar */}
      <div className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{connection.name}</p>
        </div>
        <SchemaSidebar connection={connection} onTableSelect={handleTableSelect} />
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex shrink-0 items-center overflow-x-auto border-b border-border bg-background">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={[
                "group relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border/50 px-3 py-2 text-xs select-none transition-colors",
                tab.id === activeTabId
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              ].join(" ")}
            >
              {tab.id === activeTabId && (
                <span className="absolute inset-x-0 bottom-0 h-px bg-primary" />
              )}
              <span className="max-w-[100px] truncate">{tab.label}</span>
              {tabs.length > 1 && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  className="ml-0.5 flex size-3.5 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-60 hover:!opacity-100"
                >
                  <X className="size-2.5" />
                </span>
              )}
            </button>
          ))}
          <button
            onClick={addTab}
            title="New tab (⌘T)"
            className="flex shrink-0 cursor-pointer items-center px-2 py-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* Active db breadcrumb */}
        {activeTab.activeDatabase && (
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-1">
            <span className="text-[11px] text-muted-foreground">db</span>
            <span className="text-[11px] text-muted-foreground">/</span>
            <span className="text-[11px] font-medium text-foreground">{activeTab.activeDatabase}</span>
          </div>
        )}

        {/* All editors mounted; only active is visible */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? "flex flex-1 flex-col overflow-hidden" : "hidden"}
          >
            <QueryEditor
              connection={connection}
              activeDatabase={tab.activeDatabase}
              query={tab.query}
              onQueryChange={(q) =>
                setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, query: q } : t)))
              }
              runTrigger={tab.runTrigger}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
