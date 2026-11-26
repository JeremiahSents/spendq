"use client"

import { useState } from "react"
import { toast } from "sonner"

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

export function SettingsView() {
  const { state, updateSettings } = useSpend()
  const { settings } = state
  const [auto, setAuto] = useState(String(settings.autoApproveBelow))
  const [cfo, setCfo] = useState(String(settings.requireCfoAbove))

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

  const budgets = budgetVsActual(state)

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="px-4 py-2 text-right font-medium">Monthly budget</th>
                <th className="px-4 py-2 text-right font-medium">Actual</th>
                <th className="px-4 py-2 text-right font-medium">Variance</th>
                <th className="py-2 pl-4 text-right font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const variance = b.budget - b.actual
                const util = b.budget > 0 ? Math.round((b.actual / b.budget) * 100) : 0
                return (
                  <tr key={b.department} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.department}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{money(b.budget)}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{money(b.actual)}</td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right font-mono tabular-nums",
                        b.over ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {variance < 0 ? "-" : "+"}
                      {money(Math.abs(variance))}
                    </td>
                    <td className={cn("py-2 pl-4 text-right font-mono tabular-nums", b.over && "text-destructive")}>{util}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
    </div>
  )
}
