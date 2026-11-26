"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, DatabaseRestoreIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { EmptyState, SectionCard } from "@/components/shared/dashboard-ui"
import { BrandLogo } from "@/components/shared/brand-logo"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ProcurementRequest } from "@/lib/data/types"
import { shortDate } from "@/lib/format"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

import { RequestStatusBadge, recommendedAction, recommendedOption } from "./request-meta"

type Filter = "all" | "pending" | "approved" | "rejected"

const MATCH: Record<Filter, (r: ProcurementRequest) => boolean> = {
  all: () => true,
  pending: (r) => r.status === "Pending review" || r.status === "In review",
  approved: (r) => r.status.startsWith("Approved"),
  rejected: (r) => r.status === "Rejected",
}

const LABEL: Record<Filter, string> = { all: "All", pending: "Pending", approved: "Approved", rejected: "Rejected" }

const idNumber = (id: string) => Number(id.replace(/\D/g, "")) || 0

const COLUMNS = ({ money }: Pick<ReturnType<typeof useMoney>, "money">): Array<SpendColumn<ProcurementRequest>> => [
  {
    id: "id",
    header: "ID",
    accessorFn: (r) => idNumber(r.id),
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground tabular-nums">{row.original.id}</span>,
    meta: { className: "w-20" },
  },
  {
    id: "request",
    header: "Request",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.title}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.department}</div>
      </div>
    ),
    meta: { cellClassName: "max-w-72" },
  },
  {
    id: "category",
    header: "Category",
    enableSorting: false,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.category}</span>,
  },
  {
    id: "submitted",
    header: "Submitted",
    accessorFn: (r) => r.submittedAt,
    cell: ({ row }) => (
      <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {shortDate(row.original.submittedAt)}
      </span>
    ),
  },
  {
    id: "requested",
    header: "Requested /mo",
    accessorFn: (r) => r.requestedMonthly,
    cell: ({ row }) => <span className="font-mono tabular-nums">{money(row.original.requestedMonthly)}</span>,
    meta: { align: "right" },
  },
  {
    id: "optimized",
    header: "Optimized /mo",
    accessorFn: (r) => recommendedOption(r).monthly,
    cell: ({ row }) => <span className="font-mono tabular-nums">{money(recommendedOption(row.original).monthly)}</span>,
    meta: { align: "right" },
  },
  {
    id: "action",
    header: "Recommended action",
    enableSorting: false,
    cell: ({ row }) => {
      const r = row.original
      const a = r.analysis
      const brand = a.recommendedKey === "optimized" ? a.alternative?.brand : a.reuse?.brand
      return (
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
          {a.recommendedKey !== "as-requested" && brand ? <BrandLogo brand={brand} size="xs" /> : null}
          <span className={cn(a.recommendedKey === "as-requested" && "text-muted-foreground")}>{recommendedAction(r)}</span>
        </span>
      )
    },
  },
  {
    id: "avoided",
    header: "Avoided /mo",
    accessorFn: (r) => r.analysis.avoided,
    cell: ({ row }) => {
      const avoided = row.original.analysis.avoided
      return (
        <span
          className={cn("font-mono tabular-nums", avoided > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
        >
          {avoided > 0 ? money(avoided) : "—"}
        </span>
      )
    },
    meta: { align: "right" },
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
  },
]

export function RequestsTable({ onNewRequest }: { onNewRequest: () => void }) {
  const formats = useMoney()
  const { state, openDrawer, resetDemo } = useSpend()
  const [filter, setFilter] = React.useState<Filter>("all")

  const rows = state.requests.filter(MATCH[filter])
  const counts = (Object.keys(MATCH) as Filter[]).reduce(
    (acc, f) => ({ ...acc, [f]: state.requests.filter(MATCH[f]).length }),
    {} as Record<Filter, number>,
  )

  return (
    <SectionCard
      title="Purchase requests"
      action={
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {(Object.keys(LABEL) as Filter[]).map((f) => (
              <TabsTrigger key={f} value={f} className="px-2.5 text-xs">
                {LABEL[f]}
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{counts[f]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <DataTable
        columns={COLUMNS(formats)}
        rows={rows}
        getRowId={(r) => r.id}
        onRowClick={(r) => openDrawer({ kind: "request", id: r.id })}
        initialSorting={[{ id: "id", desc: true }]}
        caption="Purchase requests"
        empty={
          state.requests.length === 0 ? (
            <EmptyState
              title="No purchase requests yet"
              description="File a purchase request to run automated reuse and vendor benchmark checks, or load the NCBA demo dataset."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={onNewRequest}>
                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                    New purchase request
                  </Button>
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
              title={`No ${LABEL[filter].toLowerCase()} requests`}
              description="Requests appear here as soon as they are filed and analyzed."
              action={
                <button type="button" onClick={onNewRequest} className="text-xs font-medium underline underline-offset-4">
                  File a purchase request
                </button>
              }
            />
          )
        }
      />
    </SectionCard>
  )
}
