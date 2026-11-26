"use client"

import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Briefcase01Icon, Calendar03Icon, LayoutAlignRightIcon, SparklesIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSidebar } from "@/components/ui/sidebar"
import type { DateRange } from "@/lib/data/types"
import { USD_TO_KES } from "@/lib/format"
import { cn } from "@/lib/utils"
import { RANGE_LABEL, SUBSIDIARY_MULTIPLIER } from "@/lib/store/selectors"
import { WORKSPACES, useSpend, type Workspace } from "@/lib/store/spend-store"
import { pageTitle } from "./nav"
import { NotificationsPopover } from "./notifications-popover"
import { ThemeToggle } from "./theme-toggle"

const RANGES = Object.keys(RANGE_LABEL) as DateRange[]
const WORKSPACE_ITEMS = WORKSPACES.map((w) => ({ value: w, label: w }))
const RANGE_ITEMS = RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))

export function AppHeader() {
  const pathname = usePathname()
  const { isMobile, state: sidebarState, toggleSidebar } = useSidebar()
  const { state, setWorkspace, setRange, setCurrency, setCopilotOpen } = useSpend()
  const showTrigger = isMobile || sidebarState === "collapsed"

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6 md:rounded-t-xl lg:px-8">
      {showTrigger ? (
        <Button variant="ghost" size="icon-sm" className="-ml-2" aria-label="Open navigation" onClick={toggleSidebar}>
          <HugeiconsIcon icon={LayoutAlignRightIcon} size={17} strokeWidth={1.8} />
        </Button>
      ) : null}

      <span className="min-w-0 truncate text-sm font-medium text-foreground">{pageTitle(pathname)}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <Select
          items={WORKSPACE_ITEMS}
          value={state.workspace}
          onValueChange={(v) => {
            if (v) setWorkspace(v as Workspace)
          }}
        >
          <SelectTrigger size="sm" aria-label="Workspace" className="max-w-24 sm:max-w-44 md:max-w-56">
            <HugeiconsIcon icon={Briefcase01Icon} size={14} strokeWidth={1.8} className="text-muted-foreground" />
            <SelectValue className="truncate" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="end">
            {WORKSPACES.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
                {w === "All Subsidiaries" ? <span className="text-xs text-muted-foreground">{SUBSIDIARY_MULTIPLIER}× modeled totals</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={RANGE_ITEMS}
          value={state.range}
          onValueChange={(v) => {
            if (v) setRange(v as DateRange)
          }}
        >
          <SelectTrigger size="sm" aria-label="Date range" className="hidden sm:flex">
            <HugeiconsIcon icon={Calendar03Icon} size={14} strokeWidth={1.8} className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="end">
            {RANGES.map((r) => (
              <SelectItem key={r} value={r}>
                {RANGE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div
          role="group"
          aria-label={"Display currency. Fixed demo rate: 1 USD = " + USD_TO_KES + " KES"}
          title={"Fixed demo rate: 1 USD = " + USD_TO_KES + " KES"}
          className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5"
        >
          {(["USD", "KES"] as const).map((currency) => (
            <button
              key={currency}
              type="button"
              aria-pressed={state.currency === currency}
              onClick={() => setCurrency(currency)}
              className={cn(
                "h-6 rounded-md px-1.5 font-mono text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2",
                state.currency === currency ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {currency}
            </button>
          ))}
        </div>
        {state.workspace === "All Subsidiaries" ? (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground xl:inline" title="Totals model three equivalent regional operations. Individual records reflect the baseline.">
            {SUBSIDIARY_MULTIPLIER}× modeled totals
          </span>
        ) : null}
        <NotificationsPopover />
        <ThemeToggle />

        <Button size="sm" className="ml-1" onClick={() => setCopilotOpen(true)}>
          <HugeiconsIcon icon={SparklesIcon} size={14} strokeWidth={2} />
          <span className="hidden sm:inline">Ask SpendIQ AI</span>
          <span className="sm:hidden">AI</span>
        </Button>
      </div>
    </header>
  )
}
