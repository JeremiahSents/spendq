"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Loading03Icon, MagicWand01Icon } from "@hugeicons/core-free-icons"

import { PillarBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DEPARTMENTS } from "@/lib/data/seed"
import type { Department, RequestCategory } from "@/lib/data/types"
import { CATALOG, CATEGORY_UNITS } from "@/lib/procurement/engine"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

const CATEGORIES: RequestCategory[] = ["Cloud Compute", "Database", "Storage", "SaaS Licenses", "AI API", "Observability"]

const STAGES = ["Scanning cloud inventory…", "Matching spare capacity…", "Benchmarking vendors…", "Checking department budget…"]
const STAGE_MS = 550 // 4 stages ≈ 2.2s
const STEPS_HOLD_MS = 1100

interface FormState {
  title: string
  department: Department | ""
  category: RequestCategory | ""
  justification: string
  capacity: string
  preferredVendor: string
  budget: string
}

const EMPTY: FormState = {
  title: "",
  department: "",
  category: "",
  justification: "",
  capacity: "",
  preferredVendor: "",
  budget: "",
}

const DEMO: FormState = {
  title: "Payments API capacity for December peak",
  department: "Digital Channels",
  category: "Cloud Compute",
  justification: "Additional compute for the mobile payments API to absorb the December salary-week peak (2.4× normal TPS).",
  capacity: "10",
  preferredVendor: "AWS EC2",
  budget: "500",
}

type Errors = Partial<Record<keyof FormState, string>>

function validate(f: FormState): Errors {
  const e: Errors = {}
  if (!f.title.trim()) e.title = "Give the request a title."
  if (!f.department) e.department = "Choose a department."
  if (!f.category) e.category = "Choose a category."
  if (!f.justification.trim()) e.justification = "Explain the business need."
  const cap = Number(f.capacity)
  if (!f.capacity.trim() || !Number.isFinite(cap) || cap <= 0) e.capacity = "Enter a quantity above zero."
  if (!f.preferredVendor.trim()) e.preferredVendor = "Name the vendor or service you would buy."
  const budget = Number(f.budget)
  if (!f.budget.trim() || !Number.isFinite(budget) || budget <= 0) e.budget = "Enter a monthly amount above zero."
  return e
}

export function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, submitRequest, openDrawer } = useSpend()
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [errors, setErrors] = React.useState<Errors>({})
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [stage, setStage] = React.useState(0)
  const timers = React.useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  React.useEffect(() => clearTimers, [])

  const reset = () => {
    clearTimers()
    setForm(EMPTY)
    setErrors({})
    setPendingId(null)
    setStage(0)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const finish = (id: string) => {
    clearTimers()
    reset()
    onOpenChange(false)
    openDrawer({ kind: "request", id })
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    // File the request first so the id exists; the dialog only delays revealing the result.
    const id = submitRequest({
      title: form.title.trim(),
      department: form.department as Department,
      category: form.category as RequestCategory,
      justification: form.justification.trim(),
      capacity: Number(form.capacity),
      preferredVendor: form.preferredVendor.trim(),
      requestedMonthly: Number(form.budget),
    })
    setPendingId(id)
    setStage(0)
    for (let i = 1; i <= STAGES.length; i++) {
      timers.current.push(window.setTimeout(() => setStage(i), STAGE_MS * i))
    }
    timers.current.push(window.setTimeout(() => finish(id), STAGE_MS * STAGES.length + STEPS_HOLD_MS))
  }

  const unit = form.category ? CATEGORY_UNITS[form.category] : "units"
  const vendorOptions = form.category ? CATALOG[form.category].map((o) => o.name) : []
  const pending = pendingId ? state.requests.find((r) => r.id === pendingId) : undefined
  const analysing = pendingId !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {analysing ? (
          <AnalysisProgress
            id={pendingId}
            stage={stage}
            steps={pending?.analysis.steps ?? []}
            onSkip={() => finish(pendingId)}
          />
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="space-y-1">
                  <DialogTitle>New purchase request</DialogTitle>
                  <DialogDescription>
                    SpendIQ checks spare inventory and cheaper alternatives before this reaches an approver.
                  </DialogDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setForm(DEMO)
                  setErrors({})
                }}
              >
                <HugeiconsIcon icon={MagicWand01Icon} strokeWidth={1.8} />
                Load demo request
              </Button>
            </DialogHeader>

            <Field id="pr-title" label="Request title" error={errors.title}>
              <Input
                id="pr-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Payments API capacity for December peak"
                aria-invalid={!!errors.title}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department" error={errors.department}>
                <Select value={form.department || null} onValueChange={(v) => v && set("department", v as Department)}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.department} aria-label="Department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Resource or service category" error={errors.category}>
                <Select value={form.category || null} onValueChange={(v) => v && set("category", v as RequestCategory)}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.category} aria-label="Category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field id="pr-justification" label="Business justification" error={errors.justification}>
              <Textarea
                id="pr-justification"
                value={form.justification}
                onChange={(e) => set("justification", e.target.value)}
                rows={3}
                placeholder="What is it for, and why now?"
                aria-invalid={!!errors.justification}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="pr-capacity" label="Required capacity or quantity" error={errors.capacity}>
                <div className="relative">
                  <Input
                    id="pr-capacity"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={form.capacity}
                    onChange={(e) => set("capacity", e.target.value)}
                    className="pr-14 font-mono tabular-nums"
                    aria-invalid={!!errors.capacity}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">
                    {unit}
                  </span>
                </div>
              </Field>
              <Field id="pr-vendor" label="Preferred vendor" error={errors.preferredVendor}>
                <Input
                  id="pr-vendor"
                  list="pr-vendor-options"
                  value={form.preferredVendor}
                  onChange={(e) => set("preferredVendor", e.target.value)}
                  placeholder={vendorOptions[0] ?? "e.g. AWS EC2"}
                  aria-invalid={!!errors.preferredVendor}
                />
                <datalist id="pr-vendor-options">
                  {vendorOptions.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </Field>
              <Field id="pr-budget" label="Estimated monthly budget" error={errors.budget}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="pr-budget"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={form.budget}
                    onChange={(e) => set("budget", e.target.value)}
                    className="pr-10 pl-6 font-mono tabular-nums"
                    aria-invalid={!!errors.budget}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">
                    /mo
                  </span>
                </div>
              </Field>
            </div>

            {vendorOptions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Price book:</span>
                {vendorOptions.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("preferredVendor", v)}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground",
                      form.preferredVendor === v && "border-foreground/30 bg-muted text-foreground",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Analyze and submit</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, error, children }: { id?: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function AnalysisProgress({ id, stage, steps, onSkip }: { id: string; stage: number; steps: string[]; onSkip: () => void }) {
  const done = stage >= STAGES.length
  return (
    <div className="grid gap-4" aria-live="polite">
      <DialogHeader>
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle>{done ? "Analysis complete" : "Analyzing request"}</DialogTitle>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{id}</span>
          <PillarBadge pillar="Automate" />
        </div>
        <DialogDescription>
          {done
            ? "Opening the comparison so you can approve the cheapest plan that meets the requirement."
            : "Checking live inventory and the benchmark price book. No one has to chase this by email."}
        </DialogDescription>
      </DialogHeader>

      <ol className="grid gap-1.5">
        {STAGES.map((label, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "todo"
          return (
            <li key={label} className={cn("flex items-center gap-2 text-sm", state === "todo" && "text-muted-foreground/60")}>
              {state === "done" ? (
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-600 dark:text-emerald-400" />
              ) : state === "active" ? (
                <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin text-muted-foreground" />
              ) : (
                <span className="inline-block size-4 rounded-full border border-dashed" />
              )}
              {label}
            </li>
          )
        })}
      </ol>

      {done ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Engine log</p>
          <ul className="grid gap-1">
            {steps.map((s) => (
              <li key={s} className="flex items-start gap-2 font-mono text-xs leading-relaxed">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant={done ? "default" : "outline"} onClick={onSkip}>
          {done ? "Open comparison" : "Skip to results"}
        </Button>
      </DialogFooter>
    </div>
  )
}
