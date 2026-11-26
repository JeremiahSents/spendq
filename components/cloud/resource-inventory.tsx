"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { BrandLogo } from "@/components/shared/brand-logo"
import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { EmptyState, SectionCard, ToneBadge, UtilizationBar } from "@/components/shared/dashboard-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CloudProvider, CloudResource, Environment } from "@/lib/data/types"
import { money } from "@/lib/format"
import { sum } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"
import { resourceStatus, type ResourceStatus, type StatusFilter } from "./resource-status"

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

interface InventoryRow {
  resource: CloudResource
  status: ResourceStatus
}

/** Null metrics (storage/platform services) sort below every measured value. */
const metric = (v: number | null) => v ?? -1

const COLUMNS: Array<SpendColumn<InventoryRow>> = [
  {
    id: "name",
    header: "Resource",
    accessorFn: (row) => row.resource.name,
    cell: ({ row }) => (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[12.5px] font-medium">{row.original.resource.name}</span>
          {row.original.resource.createdInDemo ? (
            <span className="rounded border border-primary/30 bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
              Added in demo
            </span>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground">{row.original.resource.department}</div>
      </div>
    ),
  },
  {
    id: "provider",
    header: "Provider",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <BrandLogo brand={row.original.resource.provider} size="xs" />
        {row.original.resource.provider}
      </span>
    ),
  },
  {
    id: "type",
    header: "Type",
    enableSorting: false,
    meta: { cellClassName: "text-muted-foreground" },
    cell: ({ row }) => row.original.resource.type,
  },
  {
    id: "environment",
    header: "Environment",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant="outline" className={ENV_CLASS[row.original.resource.environment]}>
        {row.original.resource.environment}
      </Badge>
    ),
  },
  {
    id: "cpu",
    header: "CPU",
    accessorFn: (row) => metric(row.resource.cpu),
    meta: { className: "w-32" },
    cell: ({ row }) => <UtilizationBar value={row.original.resource.cpu} />,
  },
  {
    id: "memory",
    header: "Memory",
    accessorFn: (row) => metric(row.resource.memory),
    meta: { className: "w-32" },
    cell: ({ row }) => <UtilizationBar value={row.original.resource.memory} />,
  },
  {
    id: "cost",
    header: "Monthly cost",
    accessorFn: (row) => row.resource.monthlyCost,
    meta: { align: "right", cellClassName: "font-mono tabular-nums" },
    cell: ({ row }) => money(row.original.resource.monthlyCost),
  },
  {
    id: "status",
    header: "Optimization status",
    enableSorting: false,
    cell: ({ row }) => <ToneBadge tone={row.original.status.tone}>{row.original.status.label}</ToneBadge>,
  },
  {
    id: "savings",
    header: "Potential savings",
    accessorFn: (row) => row.status.savings,
    meta: { align: "right", cellClassName: "font-mono tabular-nums" },
    cell: ({ row }) => {
      const s = row.original.status
      if (s.savings <= 0) return <span className="text-muted-foreground">—</span>
      return (
        <span
          className={cn("text-emerald-600 dark:text-emerald-400", s.filter === "approved" && "opacity-70")}
          title={s.filter === "approved" ? "Approved, projected" : "Pending, projected"}
        >
          {money(s.savings)}/mo
        </span>
      )
    },
  },
]

export function ResourceInventory() {
  const { state, openDrawer } = useSpend()
  const [query, setQuery] = React.useState("")
  const [provider, setProvider] = React.useState<string>("all")
  const [env, setEnv] = React.useState<string>("all")
  const [status, setStatus] = React.useState<StatusFilter>("all")

  const rows = React.useMemo<InventoryRow[]>(() => {
    const q = query.trim().toLowerCase()
    return state.resources
      .map((resource) => ({ resource, status: resourceStatus(state, resource) }))
      .filter(({ resource: r, status: s }) => {
        if (q && ![r.name, r.type, r.region].some((f) => f.toLowerCase().includes(q))) return false
        if (provider !== "all" && r.provider !== provider) return false
        if (env !== "all" && r.environment !== env) return false
        if (status !== "all" && s.filter !== status) return false
        return true
      })
  }, [state, query, provider, env, status])

  const filtersActive = query !== "" || provider !== "all" || env !== "all" || status !== "all"
  const clearFilters = () => {
    setQuery("")
    setProvider("all")
    setEnv("all")
    setStatus("all")
  }

  const totalCost = sum(rows, (r) => r.resource.monthlyCost)
  const totalSavings = sum(rows, (r) => (r.status.filter === "flagged" ? r.status.savings : 0))

  const footer: React.ReactNode[] = [
    <span key="label" className="text-xs font-normal text-muted-foreground">
      Total · {rows.length} resources
    </span>,
    null,
    null,
    null,
    null,
    null,
    <span key="cost" className="font-mono tabular-nums">
      {money(totalCost)}
    </span>,
    <span key="pending" className="text-xs font-normal text-muted-foreground">
      Pending savings
    </span>,
    <span key="savings" className="font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
      {totalSavings > 0 ? `${money(totalSavings)}/mo` : "—"}
    </span>,
  ]

  return (
    <SectionCard
      title="Resource inventory"
      description={`${rows.length} of ${state.resources.length} resources · click a row to review utilization and the recommendation`}
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
          onValueChange={(v) => setStatus((v as StatusFilter | null) ?? "all")}
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

      <DataTable
        className="text-[13px]"
        caption="Cloud resource inventory"
        columns={COLUMNS}
        rows={rows}
        getRowId={(row) => row.resource.id}
        onRowClick={(row) => openDrawer({ kind: "resource", id: row.resource.id })}
        initialSorting={[{ id: "cost", desc: true }]}
        footer={footer}
        empty={
          <EmptyState
            title="No resources match these filters"
            description="Try a different search term, provider, environment or status."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
      />
    </SectionCard>
  )
}
