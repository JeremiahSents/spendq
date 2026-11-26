"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, DatabaseRestoreIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { BrandLogo } from "@/components/shared/brand-logo"
import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { EmptyState, SectionCard } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEPARTMENTS } from "@/lib/data/seed"
import type { Vendor } from "@/lib/data/types"
import { moneyFormat, shortDate } from "@/lib/format"
import { daysUntil, licenseUtilization, unusedUnits, vendorMonthly } from "@/lib/store/selectors"
import { useSpend, type SpendState } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

import { FilterSelect } from "./filter-select"
import { DaysBadge, LicenseBar, VendorStatusBadge, isUsageBased, primaryVendorRec, vendorRecs } from "./vendor-status"

type StatusFilter = "all" | "flagged" | "renewing" | "approved" | "healthy"

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "flagged", label: "Flagged" },
  { value: "renewing", label: "Renewing ≤90d" },
  { value: "approved", label: "Approved" },
  { value: "healthy", label: "Healthy" },
]

function vendorColumns(state: SpendState): Array<SpendColumn<Vendor>> {
  const { money } = moneyFormat(state.currency)
  return [
    {
      id: "vendor",
      header: "Vendor",
      accessorFn: (v) => v.name,
      meta: { className: "min-w-52" },
      cell: ({ row }) => {
        const v = row.original
        return (
          <div className="flex items-center gap-2.5">
            <BrandLogo brand={v.brand} size="sm" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{v.name}</span>
                {v.createdInDemo ? (
                  <span className="inline-flex h-4 shrink-0 items-center rounded border border-dashed px-1 font-mono text-[10px] tracking-wide text-muted-foreground">
                    Added in demo
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {v.plan} · {v.department}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: "category",
      header: "Service category",
      accessorFn: (v) => v.category,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.category}</span>,
    },
    {
      id: "plan",
      header: "Plan",
      accessorFn: (v) => v.plan,
      cell: ({ row }) => row.original.plan,
    },
    {
      id: "cost",
      header: "Monthly / annual",
      accessorFn: (v) => vendorMonthly(v),
      sortDescFirst: true,
      meta: { align: "right" },
      cell: ({ row }) => {
        const monthly = vendorMonthly(row.original)
        return (
          <>
            <div className="font-mono tabular-nums">{money(monthly)}</div>
            <div className="font-mono text-xs text-muted-foreground tabular-nums">{money(monthly * 12)}/yr</div>
          </>
        )
      },
    },
    {
      id: "utilization",
      header: "Licenses",
      accessorFn: (v) => (isUsageBased(v) ? 101 : licenseUtilization(v)),
      meta: { className: "min-w-44" },
      cell: ({ row }) => {
        const v = row.original
        if (isUsageBased(v)) {
          return (
            <>
              <div className="text-xs">Usage-based</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Billed on consumption</div>
            </>
          )
        }
        const unused = unusedUnits(v)
        return (
          <>
            <div className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
              <span>
                {v.active.toLocaleString("en-US")}
                <span className="text-muted-foreground"> / {v.purchased.toLocaleString("en-US")}</span>
              </span>
              <span className={cn("text-muted-foreground", unused === 0 && "invisible")}>{unused} unused</span>
            </div>
            <LicenseBar value={licenseUtilization(v)} className="mt-1 w-40" />
          </>
        )
      },
    },
    {
      id: "renewal",
      header: "Renewal",
      accessorFn: (v) => daysUntil(v.renewalDate),
      cell: ({ row }) => {
        const v = row.original
        return (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs tabular-nums">{shortDate(v.renewalDate)}</span>
              <DaysBadge days={daysUntil(v.renewalDate)} />
            </div>
            {v.autoRenew ? (
              <span className="mt-1 inline-block rounded border px-1 py-px text-[10px] text-muted-foreground">Auto-renew</span>
            ) : null}
          </>
        )
      },
    },
    {
      id: "status",
      header: "Optimization status",
      enableSorting: false,
      cell: ({ row }) => {
        const recs = vendorRecs(state, row.original.id)
        return <VendorStatusBadge rec={recs[0]} more={recs.length - 1} />
      },
    },
  ]
}

export function VendorDirectory({ onAddVendor }: { onAddVendor?: () => void }) {
  const { state, openDrawer, resetDemo } = useSpend()
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [department, setDepartment] = React.useState("all")
  const [status, setStatus] = React.useState<StatusFilter>("all")

  const categories = React.useMemo(() => [...new Set(state.vendors.map((v) => v.category))].sort(), [state.vendors])
  const columns = React.useMemo(() => vendorColumns(state), [state])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.vendors.filter((v) => {
      if (q && ![v.name, v.category, v.department, v.plan].some((s) => s.toLowerCase().includes(q))) return false
      if (category !== "all" && v.category !== category) return false
      if (department !== "all" && v.department !== department) return false
      const rec = primaryVendorRec(state, v.id)
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
  }, [state, query, category, department, status])

  const filtersActive = query !== "" || category !== "all" || department !== "all" || status !== "all"
  const clearFilters = () => {
    setQuery("")
    setCategory("all")
    setDepartment("all")
    setStatus("all")
  }

  return (
    <SectionCard
      title="Vendor directory"
      description={`${rows.length} of ${state.vendors.length} vendors · click a row for contract, utilization and alternatives`}
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

      <DataTable
        caption="Vendor directory"
        columns={columns}
        rows={rows}
        getRowId={(v) => v.id}
        onRowClick={(v) => openDrawer({ kind: "vendor", id: v.id })}
        initialSorting={[{ id: "cost", desc: true }]}
        className="text-[13px]"
        empty={
          state.vendors.length === 0 ? (
            <EmptyState
              title="No vendor contracts yet"
              description="Add a SaaS or enterprise vendor to track seats and renewals, or load the NCBA demo dataset."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {onAddVendor ? (
                    <Button size="sm" variant="outline" onClick={onAddVendor}>
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                      Add vendor
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      resetDemo()
                      toast.success("NCBA demo data loaded")
                    }}
                  >
                    <HugeiconsIcon icon={DatabaseRestoreIcon} strokeWidth={1.8} />
                    Load demo data
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              title="No vendors match these filters"
              description="Try a different search term or widen the category, department or status filter."
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )
        }
      />
    </SectionCard>
  )
}
