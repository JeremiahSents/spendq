"use client"

import { useState } from "react"
import { toast } from "sonner"

import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { DataLabel, PageHeader, SectionCard } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { Settings } from "@/lib/data/types"
import { money } from "@/lib/format"
import { budgetVsActual } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"
import { ResetDemoDialog } from "./reset-demo-dialog"

type ToggleKey = "blockOverBudget" | "requireReuseCheck" | "notifyOnAnomaly" | "weeklyDigest"

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "blockOverBudget", label: "Block purchases that exceed department budget", hint: "Requests that push a department over its monthly budget are held for review." },
  { key: "requireReuseCheck", label: "Require reuse check before new cloud purchases", hint: "Procurement checks spare capacity before approving new infrastructure." },
  { key: "notifyOnAnomaly", label: "Notify on spend anomalies", hint: "Alert owners when spend deviates from its baseline." },
  { key: "weeklyDigest", label: "Weekly savings digest", hint: "A summary of pending and approved savings every Monday." },
]

function MoneyInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  invalid: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className="pl-6 font-mono tabular-nums"
      />
    </div>
  )
}

type BudgetRow = {
  department: string
  budget: number
  actual: number
  over: boolean
  variance: number
  util: number
}

const BUDGET_COLUMNS: Array<SpendColumn<BudgetRow>> = [
  {
    id: "department",
    header: "Department",
    accessorFn: (r) => r.department,
    cell: ({ row }) => <span className="font-medium">{row.original.department}</span>,
  },
  {
    id: "budget",
    header: "Monthly budget",
    accessorFn: (r) => r.budget,
    cell: ({ row }) => <span className="font-mono tabular-nums">{money(row.original.budget)}</span>,
    meta: { align: "right" },
  },
  {
    id: "actual",
    header: "Actual",
    accessorFn: (r) => r.actual,
    cell: ({ row }) => <span className="font-mono tabular-nums">{money(row.original.actual)}</span>,
    meta: { align: "right" },
  },
  {
    id: "variance",
    header: "Variance",
    accessorFn: (r) => r.variance,
    cell: ({ row }) => (
      <span
        className={cn(
          "font-mono tabular-nums",
          row.original.over ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {row.original.variance < 0 ? "-" : "+"}
        {money(Math.abs(row.original.variance))}
      </span>
    ),
    meta: { align: "right" },
  },
  {
    id: "util",
    header: "Utilization",
    accessorFn: (r) => r.util,
    cell: ({ row }) => (
      <span className={cn("font-mono tabular-nums", row.original.over && "text-destructive")}>{row.original.util}%</span>
    ),
    meta: { align: "right" },
  },
]

export function SettingsView() {
  const { state, updateSettings } = useSpend()
  const { settings } = state
  const [auto, setAuto] = useState(String(settings.autoApproveBelow))
  const [cfo, setCfo] = useState(String(settings.requireCfoAbove))
  const [resetOpen, setResetOpen] = useState(false)

  // Settings can change underneath the form (restored from storage, or a demo reset): follow them.
  const [synced, setSynced] = useState(settings)
  if (synced.autoApproveBelow !== settings.autoApproveBelow || synced.requireCfoAbove !== settings.requireCfoAbove) {
    setSynced(settings)
    setAuto(String(settings.autoApproveBelow))
    setCfo(String(settings.requireCfoAbove))
  }

  const autoN = Number(auto)
  const cfoN = Number(cfo)
  const autoValid = auto.trim() !== "" && Number.isFinite(autoN) && autoN >= 0
  const cfoValid = cfo.trim() !== "" && Number.isFinite(cfoN) && cfoN >= 0
  const orderValid = autoValid && cfoValid && cfoN > autoN
  const error =
    !autoValid || !cfoValid
      ? "Enter valid, non-negative dollar amounts."
      : !orderValid
        ? "The CFO sign-off threshold must exceed the auto-approve threshold."
        : null
  const dirty = autoN !== settings.autoApproveBelow || cfoN !== settings.requireCfoAbove

  function save() {
    if (error) return
    updateSettings({ autoApproveBelow: autoN, requireCfoAbove: cfoN })
    toast.success("Approval thresholds saved")
  }

  function toggle(key: ToggleKey, value: boolean, label: string) {
    updateSettings({ [key]: value } as Partial<Settings>)
    toast(`${label} ${value ? "enabled" : "disabled"}`)
  }

  const budgets: BudgetRow[] = budgetVsActual(state).map((b) => ({
    ...b,
    variance: b.budget - b.actual,
    util: b.budget > 0 ? Math.round((b.actual / b.budget) * 100) : 0,
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Approval thresholds and budget policy for the NCBA Tech & Cloud Ops workspace."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Approval thresholds" description="Monthly impact that decides who approves a recommendation.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto-approve">Auto-approve recommendations below</Label>
              <MoneyInput id="auto-approve" value={auto} onChange={setAuto} invalid={!autoValid || (autoValid && cfoValid && !orderValid)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfo-above">Require CFO sign-off above</Label>
              <MoneyInput id="cfo-above" value={cfo} onChange={setCfo} invalid={!cfoValid || (autoValid && cfoValid && !orderValid)} />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button size="sm" onClick={save} disabled={!!error || !dirty}>
              Save thresholds
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Budget policy" description="Applied immediately to new requests and alerts.">
          <ul className="divide-y">
            {TOGGLES.map((t) => (
              <li key={t.key} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Label htmlFor={t.key} className="text-sm font-medium">
                    {t.label}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <Switch
                  id={t.key}
                  checked={settings[t.key]}
                  onCheckedChange={(v) => toggle(t.key, v, t.label)}
                  className="mt-0.5"
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Department budgets" description="Monthly budget against current run-rate. Read-only.">
        <DataTable columns={BUDGET_COLUMNS} rows={budgets} getRowId={(r) => r.department} caption="Department budgets" />
      </SectionCard>

      <SectionCard title="Workspace">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{state.workspace}</span>
          <DataLabel kind="simulated" />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Data is simulated for the NCBA hackathon demo. No live systems are read or changed.
        </p>
      </SectionCard>

      <SectionCard title="Demo data" description="The demo has no database of its own.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-xs text-muted-foreground">
            Decisions, purchase requests and settings are saved in this browser (localStorage), so they survive a
            refresh but stay on this device. Reset to start the walkthrough again from the original data.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Reset demo
          </Button>
        </div>
      </SectionCard>
      <ResetDemoDialog open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  )
}
