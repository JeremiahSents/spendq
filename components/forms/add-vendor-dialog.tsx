"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, CheckmarkCircle02Icon, MagicWand01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { BrandLogo } from "@/components/shared/brand-logo"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DEPARTMENTS } from "@/lib/data/seed"
import type { BrandKey, Department, VendorKey } from "@/lib/data/types"
import { money } from "@/lib/format"
import type { NewVendorInput } from "@/lib/store/create"
import { useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

import { FORM_DIALOG_CLASS, Field, NumberInput, SuggestionChips, num } from "./form-fields"

const VENDOR_BRANDS: VendorKey[] = [
  "GitHub",
  "Slack",
  "Microsoft 365",
  "Microsoft Teams",
  "OpenAI",
  "Anthropic",
  "Figma",
  "Notion",
  "Datadog",
  "New Relic",
  "Grafana",
  "Zoom",
  "Confluence",
  "Jira",
  "Salesforce",
  "Liquid",
]
const OTHER = "Other"
type BrandChoice = VendorKey | typeof OTHER

const CATEGORY_SUGGESTIONS = ["Collaboration", "Developer tools", "Observability", "AI", "Productivity", "CRM"]

interface FormState {
  name: string
  brand: BrandChoice | ""
  category: string
  plan: string
  department: Department | ""
  unit: "seats" | "hosts"
  unitPrice: string
  purchased: string
  active: string
  termMonths: string
  startDate: string
  renewalDate: string
  autoRenew: boolean
  noticeDays: string
  owner: string
}

const EMPTY: FormState = {
  name: "",
  brand: "",
  category: "",
  plan: "",
  department: "",
  unit: "seats",
  unitPrice: "",
  purchased: "",
  active: "",
  termMonths: "12",
  startDate: "",
  renewalDate: "",
  autoRenew: true,
  noticeDays: "30",
  owner: "",
}

const EXAMPLES: { label: string; form: FormState }[] = [
  {
    label: "Underused Miro",
    form: {
      name: "Miro Enterprise",
      brand: OTHER,
      category: "Collaboration",
      plan: "Enterprise",
      department: "Digital Channels",
      unit: "seats",
      unitPrice: "16",
      purchased: "250",
      active: "112",
      termMonths: "12",
      startDate: "2026-02-01",
      renewalDate: "2027-02-01",
      autoRenew: true,
      noticeDays: "30",
      owner: "Head of Product",
    },
  },
  {
    label: "Healthy Postman",
    form: {
      name: "Postman Enterprise",
      brand: OTHER,
      category: "Developer tools",
      plan: "Enterprise",
      department: "Cloud Platform",
      unit: "seats",
      unitPrice: "49",
      purchased: "60",
      active: "57",
      termMonths: "12",
      startDate: "2026-05-01",
      renewalDate: "2027-05-01",
      autoRenew: true,
      noticeDays: "30",
      owner: "Head of Platform Engineering",
    },
  },
]

type Errors = Partial<Record<keyof FormState, string>>

const isInt = (n: number | null) => n !== null && Number.isInteger(n)

function validate(f: FormState): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = "Enter the vendor or product name."
  if (!f.brand) e.brand = "Choose a brand, or Other."
  if (!f.category.trim()) e.category = "Enter a category."
  if (!f.plan.trim()) e.plan = "Enter the plan or tier."
  if (!f.department) e.department = "Choose the owning department."
  const price = num(f.unitPrice)
  if (price === null || price <= 0) e.unitPrice = "Enter a price above zero."
  const purchased = num(f.purchased)
  const active = num(f.active)
  if (!isInt(purchased) || purchased! <= 0) e.purchased = "Enter a whole number above zero."
  if (!isInt(active) || active! < 0) e.active = "Enter a whole number, 0 or more."
  else if (isInt(purchased) && active! > purchased!) e.active = `Active can't exceed purchased (${purchased}).`
  const term = num(f.termMonths)
  if (!isInt(term) || term! <= 0) e.termMonths = "Enter months above zero."
  if (!f.startDate) e.startDate = "Pick a start date."
  if (!f.renewalDate) e.renewalDate = "Pick a renewal date."
  else if (f.startDate && f.renewalDate <= f.startDate) e.renewalDate = "Renewal must be after the start date."
  const notice = num(f.noticeDays)
  if (!isInt(notice) || notice! < 0) e.noticeDays = "Enter days, 0 or more."
  if (!f.owner.trim()) e.owner = "Name the contract owner."
  return e
}

function preview(f: FormState) {
  const price = num(f.unitPrice) ?? 0
  const purchased = num(f.purchased) ?? 0
  const active = num(f.active) ?? 0
  const monthly = price * purchased
  const utilization = purchased > 0 ? active / purchased : null
  const unused = Math.max(0, purchased - active)
  const fires = utilization !== null && utilization < 0.8 && unused > 0
  return { monthly, annual: monthly * 12, utilization, unused, fires, saving: unused * price, ready: purchased > 0 && price > 0 }
}

/** Date input styled like Input. */
function DateInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <Input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="font-mono tabular-nums"
      aria-invalid={invalid}
    />
  )
}

export function AddVendorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addVendor, openDrawer } = useSpend()
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [errors, setErrors] = React.useState<Errors>({})

  const reset = () => {
    setForm(EMPTY)
    setErrors({})
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const p = preview(form)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const input: NewVendorInput = {
      name: form.name.trim(),
      // "Other" has no brand mark; BrandLogo draws the SpendIQ tile for unknown keys.
      brand: (form.brand === OTHER ? "SpendIQ" : form.brand) as BrandKey,
      category: form.category.trim(),
      plan: form.plan.trim(),
      department: form.department as Department,
      unit: form.unit,
      unitPrice: Number(form.unitPrice),
      purchased: Number(form.purchased),
      active: Number(form.active),
      termMonths: Number(form.termMonths),
      startDate: form.startDate,
      renewalDate: form.renewalDate,
      autoRenew: form.autoRenew,
      noticeDays: Number(form.noticeDays),
      owner: form.owner.trim(),
    }
    const id = addVendor(input)
    const outcome = p.fires
      ? `License reclaim · ${p.unused} unused ${input.unit} · ${money(p.saving)}/mo saving added to Recommendations.`
      : `${Math.round((p.utilization ?? 1) * 100)}% utilized — no action needed.`
    toast.success(`Vendor contract added · ${input.name}`, {
      description: `${outcome} Saved in this browser.`,
      action: { label: "View", onClick: () => openDrawer({ kind: "vendor", id }) },
    })
    reset()
    onOpenChange(false)
    openDrawer({ kind: "vendor", id })
  }

  const unitLabel = form.unit

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={FORM_DIALOG_CLASS}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b p-4">
            <div className="space-y-1 pr-8">
              <DialogTitle>Add vendor contract</DialogTitle>
              <DialogDescription>
                SpendIQ checks license utilization on save. Below 80% active, it recommends reclaiming the unused {unitLabel}.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Button
                  key={ex.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm(ex.form)
                    setErrors({})
                  }}
                >
                  <HugeiconsIcon icon={MagicWand01Icon} strokeWidth={1.8} />
                  Load example: {ex.label}
                </Button>
              ))}
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ven-name" label="Vendor / product" error={errors.name}>
                <Input
                  id="ven-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Miro Enterprise"
                  aria-invalid={!!errors.name}
                />
              </Field>
              <Field label="Brand" error={errors.brand}>
                <Select value={form.brand || null} onValueChange={(v) => v && set("brand", v as BrandChoice)}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.brand} aria-label="Brand">
                    <SelectValue>
                      {(v: string | null) =>
                        v ? (
                          <span className="flex items-center gap-2">
                            <BrandLogo brand={v === OTHER ? "SpendIQ" : v} size="xs" />
                            {v}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select brand</span>
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        <BrandLogo brand={b} size="xs" />
                        {b}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER}>
                      <BrandLogo brand="SpendIQ" size="xs" />
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="ven-category" label="Category" error={errors.category}>
                <Input
                  id="ven-category"
                  list="ven-category-options"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="e.g. Collaboration"
                  aria-invalid={!!errors.category}
                />
                <datalist id="ven-category-options">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field id="ven-plan" label="Plan" error={errors.plan}>
                <Input
                  id="ven-plan"
                  value={form.plan}
                  onChange={(e) => set("plan", e.target.value)}
                  placeholder="e.g. Enterprise"
                  aria-invalid={!!errors.plan}
                />
              </Field>
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
            </div>
            <SuggestionChips
              options={CATEGORY_SUGGESTIONS}
              value={form.category}
              onPick={(v) => set("category", v)}
              label="Categories:"
            />

            <div className="grid gap-3 rounded-lg border p-3">
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Unit">
                  <Select value={form.unit} onValueChange={(v) => v && set("unit", v as FormState["unit"])}>
                    <SelectTrigger className="w-full" aria-label="Unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seats">seats</SelectItem>
                      <SelectItem value="hosts">hosts</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="ven-price" label="Unit price" error={errors.unitPrice}>
                  <NumberInput
                    id="ven-price"
                    value={form.unitPrice}
                    onChange={(v) => set("unitPrice", v)}
                    prefix="$"
                    suffix="/mo"
                    invalid={!!errors.unitPrice}
                  />
                </Field>
                <Field id="ven-purchased" label={`Purchased ${unitLabel}`} error={errors.purchased}>
                  <NumberInput
                    id="ven-purchased"
                    value={form.purchased}
                    onChange={(v) => set("purchased", v)}
                    step="1"
                    invalid={!!errors.purchased}
                  />
                </Field>
                <Field id="ven-active" label={`Active ${unitLabel}`} error={errors.active}>
                  <NumberInput
                    id="ven-active"
                    value={form.active}
                    onChange={(v) => set("active", v)}
                    step="1"
                    invalid={!!errors.active}
                  />
                </Field>
              </div>
              <LicensePreview p={p} unit={unitLabel} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="ven-term" label="Term" error={errors.termMonths}>
                <NumberInput
                  id="ven-term"
                  value={form.termMonths}
                  onChange={(v) => set("termMonths", v)}
                  suffix="months"
                  step="1"
                  invalid={!!errors.termMonths}
                />
              </Field>
              <Field id="ven-start" label="Start date" error={errors.startDate}>
                <DateInput id="ven-start" value={form.startDate} onChange={(v) => set("startDate", v)} invalid={!!errors.startDate} />
              </Field>
              <Field id="ven-renewal" label="Renewal date" error={errors.renewalDate}>
                <DateInput
                  id="ven-renewal"
                  value={form.renewalDate}
                  onChange={(v) => set("renewalDate", v)}
                  invalid={!!errors.renewalDate}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 sm:self-end">
                <Label htmlFor="ven-auto-renew" className="text-sm">
                  Auto-renews
                </Label>
                <Switch id="ven-auto-renew" checked={form.autoRenew} onCheckedChange={(c) => set("autoRenew", c)} />
              </div>
              <Field id="ven-notice" label="Notice period" error={errors.noticeDays}>
                <NumberInput
                  id="ven-notice"
                  value={form.noticeDays}
                  onChange={(v) => set("noticeDays", v)}
                  suffix="days"
                  step="1"
                  invalid={!!errors.noticeDays}
                />
              </Field>
              <Field id="ven-owner" label="Contract owner" error={errors.owner}>
                <Input
                  id="ven-owner"
                  value={form.owner}
                  onChange={(e) => set("owner", e.target.value)}
                  placeholder="e.g. Head of Product"
                  aria-invalid={!!errors.owner}
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add contract</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LicensePreview({ p, unit }: { p: ReturnType<typeof preview>; unit: string }) {
  const util = p.utilization
  return (
    <div
      aria-live="polite"
      className={cn(
        "grid gap-2 rounded-md border px-3 py-2.5",
        p.fires ? "border-amber-500/30 bg-amber-500/10" : "border-dashed bg-muted/40",
      )}
    >
      <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">Rule preview</p>
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Monthly" value={p.ready ? money(p.monthly) : "—"} />
        <Stat label="Annual" value={p.ready ? money(p.annual) : "—"} />
        <Stat label="Utilization" value={util !== null ? `${Math.round(util * 100)}%` : "—"} />
      </dl>
      {!p.ready || util === null ? (
        <p className="text-sm text-muted-foreground">Enter price, purchased and active {unit} to check the license rule.</p>
      ) : p.fires ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="flex min-w-0 items-start gap-2 text-sm">
            <HugeiconsIcon icon={Alert02Icon} size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <span className="font-medium">License reclaim</span>
              <span className="block text-xs text-muted-foreground">
                Below 80% active → reclaim {p.unused} unused {unit}
              </span>
            </span>
          </p>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
              {money(p.saving)}/mo
            </p>
            <p className="text-[11px] text-muted-foreground">projected saving</p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-600 dark:text-emerald-400" />
          Healthy — no action
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
