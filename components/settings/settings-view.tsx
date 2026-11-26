"use client"

import { useState } from "react"
import { toast } from "sonner"

import { MoneyInput } from "@/components/forms/form-fields"
import { DataTable, type SpendColumn } from "@/components/shared/data-table"
import { DataLabel, PageHeader, SectionCard, ToneBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { seedSettings } from "@/lib/data/seed"
import type { Settings } from "@/lib/data/types"
import { budgetVsActual } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"
import { ResetDemoDialog, type DemoDataMode } from "./reset-demo-dialog"

type ToggleKey = "blockOverBudget" | "requireReuseCheck" | "notifyOnAnomaly" | "weeklyDigest"

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "blockOverBudget", label: "Block purchases that exceed department budget", hint: "Requests that push a department over its monthly budget are held for review." },
  { key: "requireReuseCheck", label: "Require reuse check before new cloud purchases", hint: "Procurement checks spare capacity before approving new infrastructure." },
  { key: "notifyOnAnomaly", label: "Notify on spend anomalies", hint: "Alert owners when spend deviates from its baseline." },
  { key: "weeklyDigest", label: "Weekly savings digest", hint: "A summary of pending and approved savings every Monday." },
]

type BudgetRow = {
  department: string
  budget: number
  actual: number
  over: boolean
  variance: number
  util: number
}

const BUDGET_COLUMNS = ({ money }: Pick<ReturnType<typeof useMoney>, "money">): Array<SpendColumn<BudgetRow>> => [
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
  const formats = useMoney()
  const { state, updateSettings, resetDemo } = useSpend()
  const { settings } = state
  const [auto, setAuto] = useState(String(settings.autoApproveBelow))
  const [cfo, setCfo] = useState(String(settings.requireCfoAbove))
  const [dialogMode, setDialogMode] = useState<DemoDataMode | null>(null)
  const isEmpty = state.resources.length === 0 && state.vendors.length === 0 && state.requests.length === 0

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
      ? "Enter valid, non-negative amounts."
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
        <DataTable columns={BUDGET_COLUMNS(formats)} rows={budgets} getRowId={(r) => r.department} caption="Department budgets" />
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

      <SectionCard
        title="Demo data"
        description="Switch between a blank workspace for presenting from scratch and the seeded NCBA demo estate."
        action={
          <ToneBadge tone={state.blankMode ? "neutral" : "info"}>
            {state.blankMode ? "Blank mode" : "Demo data loaded"}
          </ToneBadge>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-xs text-muted-foreground">
            Changes stay in this browser (localStorage). Clear starting data to build live from zero, or restore the
            NCBA demo dataset at any time.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={state.blankMode && isEmpty}
              onClick={() => setDialogMode("blank")}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Start blank
            </Button>
            <Button
              variant={state.blankMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (isEmpty) {
                  resetDemo()
                  setAuto(String(seedSettings.autoApproveBelow))
                  setCfo(String(seedSettings.requireCfoAbove))
                  toast.success("NCBA demo data loaded")
                  return
                }
                setDialogMode("demo")
              }}
            >
              {state.blankMode ? "Load demo data" : "Reset demo data"}
            </Button>
          </div>
        </div>
      </SectionCard>
      <ResetDemoDialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null)
        }}
        mode={dialogMode ?? "demo"}
      />
    </div>
  )
}
