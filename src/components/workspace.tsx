import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const dragTabRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastSwapTargetRef = useRef<string | null>(null)
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const prevRectsRef = useRef<Record<string, DOMRect>>({})
  const animateLayoutRef = useRef(false)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  function captureTabRects() {
    const next: Record<string, DOMRect> = {}
    for (const tab of tabs) {
      const el = tabRefs.current[tab.id]
      if (el) next[tab.id] = el.getBoundingClientRect()
    }
    prevRectsRef.current = next
  }

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
      if (next.length === 0) return prev  // keep at least one tab
      if (id === activeTabId) {
        setActiveTabId(next[Math.min(idx, next.length - 1)].id)
      }
      return next
    })
  }

  function handleTableSelect(database: string, table: string, openInNewTab: boolean) {
    const query = `SELECT *\nFROM ${table}`
    if (openInNewTab) {
      tabCountRef.current += 1
      const tab: Tab = {
        id: crypto.randomUUID(),
        label: table,
        query,
        activeDatabase: database,
        runTrigger: 1,
      }
      setTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
    } else {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, label: table, activeDatabase: database, query, runTrigger: t.runTrigger + 1 }
            : t
        )
      )
    }
  }

  function reorderTabs(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    captureTabRects()
    animateLayoutRef.current = true
    setTabs((prev) => {
      const from = prev.findIndex((t) => t.id === sourceId)
      const to = prev.findIndex((t) => t.id === targetId)
      if (from === -1 || to === -1) return prev

      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  useLayoutEffect(() => {
    if (!animateLayoutRef.current) {
      captureTabRects()
      return
    }

    for (const tab of tabs) {
      const el = tabRefs.current[tab.id]
      const prevRect = prevRectsRef.current[tab.id]
      if (!el || !prevRect) continue

      const nextRect = el.getBoundingClientRect()
      const deltaX = prevRect.left - nextRect.left
      if (Math.abs(deltaX) < 1) continue

      el.style.transition = "none"
      el.style.transform = `translateX(${deltaX}px)`
      el.getBoundingClientRect()
      requestAnimationFrame(() => {
        el.style.transition = "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)"
        el.style.transform = "translateX(0)"
      })
    }

    animateLayoutRef.current = false
    captureTabRects()
  }, [tabs])

  function handlePointerDown(tabId: string, e: React.PointerEvent<HTMLDivElement>) {
    // Left click / primary touch only
    if (e.button !== 0 && e.pointerType !== "touch") return
    dragTabRef.current = tabId
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragMovedRef.current = false
    lastSwapTargetRef.current = null
    setDraggingTabId(tabId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const draggedId = dragTabRef.current
    if (!draggedId) return

    const start = dragStartRef.current
    if (start && !dragMovedRef.current) {
      const movedEnough =
        Math.abs(e.clientX - start.x) > 4 || Math.abs(e.clientY - start.y) > 4
      if (movedEnough) dragMovedRef.current = true
    }

    if (!dragMovedRef.current) return

    const targetEl = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-tab-id]")
    const targetId = targetEl?.dataset.tabId
    if (!targetId || targetId === draggedId) return
    if (lastSwapTargetRef.current === targetId) return

    const sourceIndex = tabs.findIndex((t) => t.id === draggedId)
    const targetIndex = tabs.findIndex((t) => t.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return

    const targetRect = targetEl.getBoundingClientRect()
    const midpointX = targetRect.left + targetRect.width / 2
    const movingRight = targetIndex > sourceIndex
    const crossedMidpoint = movingRight ? e.clientX > midpointX : e.clientX < midpointX
    if (!crossedMidpoint) return

    reorderTabs(draggedId, targetId)
    lastSwapTargetRef.current = targetId
  }

  function handlePointerUp() {
    handleDragEnd()
  }

  function handleDragEnd() {
    setDraggingTabId(null)
    dragTabRef.current = null
    dragStartRef.current = null
    dragMovedRef.current = false
    lastSwapTargetRef.current = null
  }

  useEffect(() => {
    function handleGlobalPointerUp() {
      if (!dragTabRef.current) return
      handleDragEnd()
    }

    window.addEventListener("pointerup", handleGlobalPointerUp)
    window.addEventListener("pointercancel", handleGlobalPointerUp)
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      window.removeEventListener("pointercancel", handleGlobalPointerUp)
    }
  }, [])

  // ⌘T → new tab, ⌘W → close active tab
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!e.metaKey) return
      if (e.key === "t") {
        e.preventDefault()
        addTab()
      } else if (e.key === "w") {
        e.preventDefault()
        setTabs((prev) => {
          if (prev.length <= 1) return prev
          const idx = prev.findIndex((t) => t.id === activeTabId)
          const next = prev.filter((t) => t.id !== activeTabId)
          setActiveTabId(next[Math.min(idx, next.length - 1)].id)
          return next
        })
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [activeTabId])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Schema sidebar */}
      <div className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{connection.name}</p>
        </div>
        <SchemaSidebar connection={connection} onTableSelect={(db, table, newTab) => handleTableSelect(db, table, newTab)} />
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar */}
        <div
          className="flex shrink-0 items-center overflow-x-auto border-b border-border bg-background"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isDragging = tab.id === draggingTabId
            return (
              <div
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el }}
                onPointerDown={(e) => handlePointerDown(e.currentTarget.dataset.tabId ?? tab.id, e)}
                data-tab-id={tab.id}
                onClick={() => {
                  if (dragMovedRef.current) return
                  setActiveTabId(tab.id)
                }}
                className={[
                  "group relative flex shrink-0 cursor-grab active:cursor-grabbing items-center gap-1.5 border-r border-border/50 px-3 py-2 text-xs select-none",
                  isActive
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  "transition-[transform,opacity,background-color,color] duration-150 ease-out",
                  isDragging ? "opacity-80" : "transition-colors",
                ].join(" ")}
                style={{ touchAction: "none" }}
              >
                {isActive && <span className="absolute inset-x-0 bottom-0 h-px bg-primary" />}

                <span className="max-w-[100px] truncate">{tab.label}</span>
                {tabs.length > 1 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDragEnd()
                      closeTab(tab.id)
                    }}
                    className="ml-0.5 flex size-3.5 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-60 hover:!opacity-100"
                  >
                    <X className="size-2.5" />
                  </span>
                )}
              </div>
            )
          })}
          <button
            onClick={addTab}
            title="New tab  ⌘T"
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
