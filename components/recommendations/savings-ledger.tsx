"use client"

import * as React from "react"

import { BrandLogo } from "@/components/shared/brand-logo"
import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { DataLabel, EmptyState, SectionCard } from "@/components/shared/dashboard-ui"
import type { Recommendation } from "@/lib/data/types"
import { recSavings, savings } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"

import { EngineTag } from "./engine-tag"
import { isEngineRec, savingKind } from "./filters"

const columns = ({ money, perMonth, perYear }: Pick<ReturnType<typeof useMoney>, "money" | "perMonth" | "perYear">): Array<SpendColumn<Recommendation>> => [
  {
    id: "recommendation",
    header: "Approved action",
    accessorFn: (r) => r.title,
    meta: { className: "min-w-64", cellClassName: "max-w-0 w-full" },
    cell: ({ row }) => {
      const r = row.original
      return (
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo brand={r.brand} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium" title={r.title}>
              {r.title}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{r.category}</span>
              {isEngineRec(r) ? <EngineTag short /> : null}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    id: "monthly",
    header: "Projected /mo",
    accessorFn: (r) => recSavings(r),
    sortDescFirst: true,
    meta: { align: "right", className: "w-32" },
    cell: ({ row }) => {
      const r = row.original
      if (savingKind(r) === "none") return <span className="text-xs text-muted-foreground">Assigned</span>
      return <span className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">{perMonth(recSavings(r))}</span>
    },
  },
  {
    id: "annual",
    header: "Projected /yr",
    accessorFn: (r) => recSavings(r) * 12,
    sortDescFirst: true,
    meta: { align: "right", className: "w-36" },
    cell: ({ row }) => {
      const r = row.original
      const kind = savingKind(r)
      if (kind === "none") return <span className="text-muted-foreground">—</span>
      return (
        <span className="font-mono tabular-nums">
          {kind === "one-time" ? `${money(recSavings(r) * 12)} one-time` : perYear(recSavings(r) * 12)}
        </span>
      )
    },
  },
]

/** Every approved recommendation and what it is projected to save. */
export function SavingsLedger() {
  const formats = useMoney()
  const { perMonth, perYear } = formats
  const { state, openDrawer } = useSpend()
  const rows = React.useMemo(() => state.recommendations.filter((r) => r.status === "Approved"), [state.recommendations])
  const monthly = savings(state).approvedMonthly

  return (
    <SectionCard
      title="Savings ledger"
      description={`${rows.length} approved action${rows.length === 1 ? "" : "s"} · committed, not yet realized`}
      action={<DataLabel kind="projected" />}
    >
      <DataTable
        caption="Savings ledger: approved recommendations"
        columns={columns(formats)}
        rows={rows}
        getRowId={(r) => r.id}
        onRowClick={(r) => openDrawer({ kind: "recommendation", id: r.id })}
        initialSorting={[{ id: "monthly", desc: true }]}
        pageSize={10}
        className="text-[13px]"
        footer={[
          <span key="label">{state.workspace === "All Subsidiaries" ? "Modeled total projected" : "Total projected"}</span>,
          <span key="mo" className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
            {perMonth(monthly)}
          </span>,
          <span key="yr" className="font-mono tabular-nums">
            {perYear(monthly * 12)}
          </span>,
        ]}
        empty={
          <EmptyState
            title="Nothing approved yet"
            description="Approve a recommendation above and its projected saving is recorded here."
          />
        }
      />
    </SectionCard>
  )
}
