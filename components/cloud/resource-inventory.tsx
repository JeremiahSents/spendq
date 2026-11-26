"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown02Icon, ArrowUp02Icon, ArrowUpDownIcon, Search01Icon } from "@hugeicons/core-free-icons"

import { BrandLogo } from "@/components/shared/brand-logo"
import { EmptyState, SectionCard, ToneBadge, UtilizationBar } from "@/components/shared/dashboard-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CloudProvider, Environment } from "@/lib/data/types"
import { money } from "@/lib/format"
import { sum } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"
import { resourceStatus, type StatusFilter } from "./resource-status"

const PROVIDERS: CloudProvider[] = ["AWS", "Azure", "DigitalOcean", "Vercel", "Neon"]
const ENVIRONMENTS: Environment[] = ["Production", "Staging", "Development"]

const PROVIDER_ITEMS: Record<string, React.ReactNode> = {
  all: "All providers",
  ...Object.fromEntries(
    PROVIDERS.map((p) => [
      p,
      <span key={p} className="flex items-center gap-1.5">
        <BrandLogo brand={p} size="xs" />
        {p}
      </span>,
    ]),
  ),
}
const ENV_ITEMS: Record<string, string> = {
  all: "All environments",
  ...Object.fromEntries(ENVIRONMENTS.map((e) => [e, e])),
}
const STATUS_ITEMS: Record<StatusFilter, string> = {
  all: "All statuses",
  optimized: "Optimized",
  flagged: "Flagged",
  spare: "Spare capacity",
  approved: "Approved",
}

const ENV_CLASS: Record<Environment, string> = {
  Production: "border-primary/25 bg-primary/10 text-primary dark:text-foreground",
  Staging: "border-border bg-secondary text-secondary-foreground",
  Development: "border-border bg-muted text-muted-foreground",
}

type SortKey = "cost" | "savings"

export function ResourceInventory() {
  const { state, openDrawer } = useSpend()
  const [query, setQuery] = React.useState("")
  const [provider, setProvider] = React.useState<string>("all")
  const [env, setEnv] = React.useState<string>("all")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "cost", dir: "desc" })

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = state.resources.map((resource) => ({ resource, status: resourceStatus(state, resource) }))
    const filtered = all.filter(({ resource: r, status: s }) => {
      if (q && ![r.name, r.type, r.region].some((f) => f.toLowerCase().includes(q))) return false
      if (provider !== "all" && r.provider !== provider) return false
      if (env !== "all" && r.environment !== env) return false
      if (status !== "all" && s.filter !== status) return false
      return true
    })
    const pick = (row: (typeof all)[number]) => (sort.key === "cost" ? row.resource.monthlyCost : row.status.savings)
    return filtered.sort((a, b) => (sort.dir === "desc" ? pick(b) - pick(a) : pick(a) - pick(b)))
  }, [state, query, provider, env, status, sort])

  const filtersActive = query !== "" || provider !== "all" || env !== "all" || status !== "all"
  const clearFilters = () => {
    setQuery("")
    setProvider("all")
    setEnv("all")
    setStatus("all")
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))

  const totalCost = sum(rows, (r) => r.resource.monthlyCost)
  const totalSavings = sum(rows, (r) => (r.status.filter === "flagged" ? r.status.savings : 0))

  return (
    <SectionCard
      title="Resource inventory"
      description={`${rows.length} of ${state.resources.length} resources · click a row to review utilization and the recommendation`}
      className="gap-3"
    >
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <div className="relative min-w-52 flex-1 sm:max-w-72">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, type or region"
            className="h-8 pl-8"
            aria-label="Search resources"
          />
        </div>
        <Select items={PROVIDER_ITEMS} value={provider} onValueChange={(v) => setProvider((v as string) ?? "all")}>
          <SelectTrigger className="min-w-40" aria-label="Filter by provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                <BrandLogo brand={p} size="xs" />
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={ENV_ITEMS} value={env} onValueChange={(v) => setEnv((v as string) ?? "all")}>
          <SelectTrigger className="min-w-40" aria-label="Filter by environment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ENV_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(v) => setStatus(((v as StatusFilter | null) ?? "all") as StatusFilter)}
        >
          <SelectTrigger className="min-w-36" aria-label="Filter by optimization status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_ITEMS) as StatusFilter[]).map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_ITEMS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="pb-1">
          <EmptyState
            title="No resources match these filters"
            description="Try a different search term, provider, environment or status."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="-mx-4 border-t">
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 pl-4 text-xs text-muted-foreground">Resource</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground">Provider</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground">Type</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground">Environment</TableHead>
                <TableHead className="h-8 w-32 text-xs text-muted-foreground">CPU</TableHead>
                <TableHead className="h-8 w-32 text-xs text-muted-foreground">Memory</TableHead>
                <SortHead label="Monthly cost" active={sort.key === "cost"} dir={sort.dir} onClick={() => toggleSort("cost")} />
                <TableHead className="h-8 text-xs text-muted-foreground">Optimization status</TableHead>
                <SortHead
                  label="Potential savings"
                  active={sort.key === "savings"}
                  dir={sort.dir}
                  onClick={() => toggleSort("savings")}
                  className="pr-4"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ resource: r, status: s }) => (
                <TableRow
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${r.name}`}
                  onClick={() => openDrawer({ kind: "resource", id: r.id })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openDrawer({ kind: "resource", id: r.id })
                    }
                  }}
                  className="cursor-pointer outline-none focus-visible:bg-muted/60"
                >
                  <TableCell className="py-1.5 pl-4">
                    <div className="font-mono text-[12.5px] font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.department}</div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="flex items-center gap-1.5">
                      <BrandLogo brand={r.provider} size="xs" />
                      {r.provider}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">{r.type}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className={ENV_CLASS[r.environment]}>
                      {r.environment}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <UtilizationBar value={r.cpu} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <UtilizationBar value={r.memory} />
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono tabular-nums">{money(r.monthlyCost)}</TableCell>
                  <TableCell className="py-1.5">
                    <ToneBadge tone={s.tone}>{s.label}</ToneBadge>
                  </TableCell>
                  <TableCell className="py-1.5 pr-4 text-right font-mono tabular-nums">
                    {s.savings > 0 ? (
                      <span
                        className={cn(
                          "text-emerald-600 dark:text-emerald-400",
                          s.filter === "approved" && "opacity-70",
                        )}
                        title={s.filter === "approved" ? "Approved, projected" : "Pending, projected"}
                      >
                        {money(s.savings)}/mo
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-2 pl-4 text-xs text-muted-foreground">
                  Total · {rows.length} resources
                </TableCell>
                <TableCell className="py-2 text-right font-mono tabular-nums">{money(totalCost)}</TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground">Pending savings</TableCell>
                <TableCell className="py-2 pr-4 text-right font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
                  {totalSavings > 0 ? `${money(totalSavings)}/mo` : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </SectionCard>
  )
}

function SortHead({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
  className?: string
}) {
  return (
    <TableHead
      className={cn("h-8 text-right text-xs", className)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <HugeiconsIcon
          icon={active ? (dir === "desc" ? ArrowDown02Icon : ArrowUp02Icon) : ArrowUpDownIcon}
          size={12}
          strokeWidth={2}
        />
      </button>
    </TableHead>
  )
}
