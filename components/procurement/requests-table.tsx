"use client"

import * as React from "react"

import { EmptyState, SectionCard } from "@/components/shared/dashboard-ui"
import { BrandLogo } from "@/components/shared/brand-logo"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ProcurementRequest } from "@/lib/data/types"
import { money } from "@/lib/format"
import { useSpend } from "@/lib/store/spend-store"
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

export function RequestsTable({ onNewRequest }: { onNewRequest: () => void }) {
  const { state, openDrawer } = useSpend()
  const [filter, setFilter] = React.useState<Filter>("all")

  const rows = state.requests.filter(MATCH[filter])
  const counts = (Object.keys(MATCH) as Filter[]).reduce(
    (acc, f) => ({ ...acc, [f]: state.requests.filter(MATCH[f]).length }),
    {} as Record<Filter, number>,
  )

  return (
    <SectionCard
      title="Purchase requests"
      description="Each request is analyzed against live inventory and the benchmark price book the moment it is filed."
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
      {rows.length === 0 ? (
        <EmptyState
          title={`No ${LABEL[filter].toLowerCase()} requests`}
          description="Requests appear here as soon as they are filed and analyzed."
          action={
            <button type="button" onClick={onNewRequest} className="text-xs font-medium underline underline-offset-4">
              File a purchase request
            </button>
          }
        />
      ) : (
        <div className="-mx-4 border-t">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs">ID</TableHead>
                <TableHead className="text-xs">Request</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-right text-xs">Requested /mo</TableHead>
                <TableHead className="text-right text-xs">Optimized /mo</TableHead>
                <TableHead className="text-xs">Recommended action</TableHead>
                <TableHead className="text-right text-xs">Avoided /mo</TableHead>
                <TableHead className="pr-4 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const best = recommendedOption(r)
                const a = r.analysis
                const brand = a.recommendedKey === "optimized" ? a.alternative?.brand : a.reuse?.brand
                return (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${r.id} ${r.title}`}
                    onClick={() => openDrawer({ kind: "request", id: r.id })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        openDrawer({ kind: "request", id: r.id })
                      }
                    }}
                    className="cursor-pointer outline-none focus-visible:bg-muted/60"
                  >
                    <TableCell className="pl-4 font-mono text-xs text-muted-foreground tabular-nums">{r.id}</TableCell>
                    <TableCell className="max-w-72">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.department}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.category}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(r.requestedMonthly)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(best.monthly)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {a.recommendedKey !== "as-requested" && brand ? <BrandLogo brand={brand} size="xs" /> : null}
                        <span className={cn(a.recommendedKey === "as-requested" && "text-muted-foreground")}>
                          {recommendedAction(r)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        a.avoided > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {a.avoided > 0 ? money(a.avoided) : "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <RequestStatusBadge status={r.status} />
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
