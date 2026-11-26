"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowUp01Icon, ArrowUpDownIcon, Search01Icon } from "@hugeicons/core-free-icons"

import { BrandLogo } from "@/components/shared/brand-logo"
import { EmptyState, SectionCard } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DEPARTMENTS } from "@/lib/data/seed"
import type { Vendor } from "@/lib/data/types"
import { money, shortDate } from "@/lib/format"
import { daysUntil, licenseUtilization, recommendationFor, unusedUnits, vendorMonthly } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

import { FilterSelect } from "./filter-select"
import { DaysBadge, LicenseBar, VendorStatusBadge } from "./vendor-status"

type StatusFilter = "all" | "flagged" | "renewing" | "approved" | "healthy"
type SortKey = "cost" | "utilization" | "renewal"

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "flagged", label: "Flagged" },
  { value: "renewing", label: "Renewing ≤90d" },
  { value: "approved", label: "Approved" },
  { value: "healthy", label: "Healthy" },
]

export function VendorDirectory() {
  const { state, openDrawer } = useSpend()
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [department, setDepartment] = React.useState("all")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "cost", dir: "desc" })

  const categories = React.useMemo(
    () => [...new Set(state.vendors.map((v) => v.category))].sort(),
    [state.vendors],
  )

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = state.vendors.filter((v) => {
      if (q && ![v.name, v.category, v.department, v.plan].some((s) => s.toLowerCase().includes(q))) return false
      if (category !== "all" && v.category !== category) return false
      if (department !== "all" && v.department !== department) return false
      const rec = recommendationFor(state, v.id)
      const days = daysUntil(v.renewalDate)
      switch (status) {
        case "flagged":
          return rec?.status === "Pending"
        case "renewing":
          return days >= 0 && days <= 90
        case "approved":
          return rec?.status === "Approved"
        case "healthy":
          return !rec
        default:
          return true
      }
    })
    const value = (v: Vendor) =>
      sort.key === "cost" ? vendorMonthly(v) : sort.key === "utilization" ? licenseUtilization(v) : daysUntil(v.renewalDate)
    return filtered.sort((a, b) => (sort.dir === "asc" ? value(a) - value(b) : value(b) - value(a)))
  }, [state, query, category, department, status, sort])

  const filtersActive = query !== "" || category !== "all" || department !== "all" || status !== "all"
  const clearFilters = () => {
    setQuery("")
    setCategory("all")
    setDepartment("all")
    setStatus("all")
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "renewal" ? "asc" : "desc" }))

  return (
    <SectionCard
      title="Vendor directory"
      description={`${rows.length} of ${state.vendors.length} vendors · click a row for contract, utilization and alternatives`}
      className="pb-0"
    >
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor, category, department"
            className="h-7 pl-8 text-sm"
            aria-label="Search vendors"
          />
        </div>
        <FilterSelect
          value={category}
          onChange={setCategory}
          allLabel="All categories"
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          value={department}
          onChange={setDepartment}
          allLabel="All departments"
          options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
        />
        <FilterSelect
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          allLabel="All statuses"
          options={STATUS_OPTIONS}
        />
        {filtersActive ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="pb-4">
          <EmptyState
            title="No vendors match these filters"
            description="Try a different search term or widen the category, department or status filter."
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
                <TableHead className="pl-4">Vendor</TableHead>
                <TableHead>Service category</TableHead>
                <TableHead>Plan</TableHead>
                <SortHead label="Monthly / annual" active={sort.key === "cost"} dir={sort.dir} onClick={() => toggleSort("cost")} align="right" />
                <SortHead label="Licenses" active={sort.key === "utilization"} dir={sort.dir} onClick={() => toggleSort("utilization")} />
                <SortHead label="Renewal" active={sort.key === "renewal"} dir={sort.dir} onClick={() => toggleSort("renewal")} />
                <TableHead className="pr-4">Optimization status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const monthly = vendorMonthly(v)
                const util = licenseUtilization(v)
                const unused = unusedUnits(v)
                const days = daysUntil(v.renewalDate)
                const rec = recommendationFor(state, v.id)
                return (
                  <TableRow
                    key={v.id}
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => openDrawer({ kind: "vendor", id: v.id })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        openDrawer({ kind: "vendor", id: v.id })
                      }
                    }}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <BrandLogo brand={v.brand} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{v.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {v.plan} · {v.department}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{v.category}</TableCell>
                    <TableCell>{v.plan}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono tabular-nums">{money(monthly)}</div>
                      <div className="font-mono text-xs text-muted-foreground tabular-nums">{money(monthly * 12)}/yr</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
                        <span>
                          {v.active.toLocaleString("en-US")}
                          <span className="text-muted-foreground"> / {v.purchased.toLocaleString("en-US")}</span>
                        </span>
                        <span className={cn("text-muted-foreground", unused === 0 && "invisible")}>{unused} unused</span>
                      </div>
                      <LicenseBar value={util} className="mt-1 w-40" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs tabular-nums">{shortDate(v.renewalDate)}</span>
                        <DaysBadge days={days} />
                      </div>
                      {v.autoRenew ? (
                        <span className="mt-1 inline-block rounded border px-1 py-px text-[10px] text-muted-foreground">Auto-renew</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="pr-4">
                      <VendorStatusBadge rec={rec} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
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
  align,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
  align?: "right"
}) {
  return (
    <TableHead className={cn(align === "right" && "text-right")} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <HugeiconsIcon icon={!active ? ArrowUpDownIcon : dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon} size={12} strokeWidth={2} />
      </button>
    </TableHead>
  )
}
