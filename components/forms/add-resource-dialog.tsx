"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, MagicWand01Icon, Alert02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { BrandLogo } from "@/components/shared/brand-logo"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DEPARTMENTS } from "@/lib/data/seed"
import type { CloudProvider, Department, Environment } from "@/lib/data/types"
import { RESOURCE_RULES, type NewResourceInput } from "@/lib/store/create"
import { workspaceIncludesDepartment } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

import { FORM_DIALOG_CLASS, Field, MoneyInput, NumberInput, SuggestionChips, num } from "./form-fields"

const PROVIDERS: CloudProvider[] = ["AWS", "Azure", "DigitalOcean", "Vercel", "Neon"]
const ENVIRONMENTS: Environment[] = ["Production", "Staging", "Development"]

const TYPE_SUGGESTIONS: Record<CloudProvider, string[]> = {
  AWS: ["EC2", "RDS PostgreSQL", "EKS cluster", "ElastiCache Redis", "S3 bucket"],
  Azure: ["Virtual Machine", "App Service", "AKS cluster", "Azure SQL Database", "Blob Storage"],
  DigitalOcean: ["Droplet", "Managed PostgreSQL", "Kubernetes cluster", "Spaces"],
  Vercel: ["Pro team", "Serverless functions", "Edge network"],
  Neon: ["Postgres", "Postgres branch"],
}

const REGION_SUGGESTIONS: Record<CloudProvider, string[]> = {
  AWS: ["af-south-1", "eu-west-1", "us-east-1"],
  Azure: ["South Africa North", "West Europe", "East US"],
  DigitalOcean: ["fra1", "lon1", "ams3"],
  Vercel: ["Global edge", "fra1"],
  Neon: ["aws-eu-central-1", "aws-us-east-1"],
}

interface FormState {
  name: string
  provider: CloudProvider | ""
  type: string
  environment: Environment | ""
  region: string
  size: string
  department: Department | ""
  vcpu: string
  memoryGb: string
  hasMetrics: boolean
  cpu: string
  memory: string
  monthlyCost: string
}

const EMPTY: FormState = {
  name: "",
  provider: "",
  type: "",
  environment: "",
  region: "",
  size: "",
  department: "",
  vcpu: "",
  memoryGb: "",
  hasMetrics: true,
  cpu: "",
  memory: "",
  monthlyCost: "",
}

const EXAMPLES: { label: string; form: FormState }[] = [
  {
    label: "Idle dev box",
    form: {
      name: "dc-loadtest-runner-03",
      provider: "AWS",
      type: "EC2",
      environment: "Development",
      region: "af-south-1",
      size: "c6i.4xlarge",
      department: "Digital Channels",
      vcpu: "16",
      memoryGb: "32",
      hasMetrics: true,
      cpu: "2",
      memory: "6",
      monthlyCost: "496",
    },
  },
  {
    label: "Oversized prod API",
    form: {
      name: "cbs-statements-api-prod",
      provider: "Azure",
      type: "App Service",
      environment: "Production",
      region: "South Africa North",
      size: "P3v3",
      department: "Core Banking",
      vcpu: "8",
      memoryGb: "32",
      hasMetrics: true,
      cpu: "18",
      memory: "27",
      monthlyCost: "620",
    },
  },
]

type Errors = Partial<Record<keyof FormState, string>>

function validate(f: FormState): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = "Enter the resource name."
  else if (/\s/.test(f.name.trim())) e.name = "Use the resource ID as it appears in the console (no spaces)."
  if (!f.provider) e.provider = "Choose a provider."
  if (!f.type.trim()) e.type = "Enter the service type."
  if (!f.environment) e.environment = "Choose an environment."
  if (!f.region.trim()) e.region = "Enter a region."
  if (!f.size.trim()) e.size = "Enter the size or tier."
  if (!f.department) e.department = "Choose the owning department."
  const vcpu = num(f.vcpu)
  const mem = num(f.memoryGb)
  if (vcpu === null || vcpu < 0) e.vcpu = "Enter 0 or more."
  else if (f.hasMetrics && vcpu === 0) e.vcpu = "Compute needs at least 1 vCPU."
  if (mem === null || mem < 0) e.memoryGb = "Enter 0 or more."
  else if (f.hasMetrics && mem === 0) e.memoryGb = "Compute needs memory above 0."
  if (f.hasMetrics) {
    const cpu = num(f.cpu)
    const memory = num(f.memory)
    if (cpu === null || cpu < 0 || cpu > 100) e.cpu = "Enter a value from 0 to 100."
    if (memory === null || memory < 0 || memory > 100) e.memory = "Enter a value from 0 to 100."
  }
  const cost = num(f.monthlyCost)
  if (cost === null || cost <= 0) e.monthlyCost = "Enter a monthly cost above zero."
  return e
}

type Preview =
  | { kind: "incomplete" }
  | { kind: "no-metrics" }
  | { kind: "healthy" }
  | { kind: "flagged"; rule: (typeof RESOURCE_RULES)[number]; saving: number }

/** Mirrors classifyResource in lib/store/create.ts so the preview matches what gets saved. */
function previewRule(f: FormState): Preview {
  if (!f.hasMetrics) return { kind: "no-metrics" }
  const cpu = num(f.cpu)
  const memory = num(f.memory)
  const cost = num(f.monthlyCost)
  if (cpu === null || memory === null || !f.environment) return { kind: "incomplete" }
  const nonProd = f.environment !== "Production"
  const rule =
    cpu < 5 && memory < 10
      ? RESOURCE_RULES[0]
      : nonProd && cpu < 30
        ? RESOURCE_RULES[1]
        : cpu < 25 && memory < 40
          ? RESOURCE_RULES[2]
          : null
  if (!rule) return { kind: "healthy" }
  const monthly = cost ?? 0
  const saving = monthly - Math.round(monthly * rule.keep * 100) / 100
  return { kind: "flagged", rule, saving }
}

export function AddResourceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { money } = useMoney()
  const { state, addResource, openDrawer } = useSpend()
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

  const preview = previewRule(form)

  const departments = DEPARTMENTS.filter((department) => workspaceIncludesDepartment(state.workspace, department))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    if (form.department && !departments.includes(form.department)) errs.department = "Choose a department in this workspace."
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const input: NewResourceInput = {
      name: form.name.trim(),
      provider: form.provider as CloudProvider,
      type: form.type.trim(),
      environment: form.environment as Environment,
      region: form.region.trim(),
      size: form.size.trim(),
      department: form.department as Department,
      vcpu: Number(form.vcpu),
      memoryGb: Number(form.memoryGb),
      cpu: form.hasMetrics ? Number(form.cpu) : null,
      memory: form.hasMetrics ? Number(form.memory) : null,
      monthlyCost: Number(form.monthlyCost),
    }
    const id = addResource(input)
    const outcome =
      preview.kind === "flagged"
        ? `${preview.rule.category} · ${money(preview.saving)}/mo saving added to Recommendations.`
        : preview.kind === "no-metrics"
          ? "No CPU/memory metrics, so no right-sizing rule applies."
          : "Healthy — no action needed."
    toast.success(`Resource added · ${input.name}`, {
      description: `${outcome} Saved in this browser.`,
      action: { label: "View", onClick: () => openDrawer({ kind: "resource", id }) },
    })
    reset()
    onOpenChange(false)
    openDrawer({ kind: "resource", id })
  }

  const typeOptions = form.provider ? TYPE_SUGGESTIONS[form.provider] : []
  const regionOptions = form.provider ? REGION_SUGGESTIONS[form.provider] : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={FORM_DIALOG_CLASS}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b p-4">
            <div className="space-y-1 pr-8">
              <DialogTitle>Add cloud resource</DialogTitle>
              <DialogDescription>
                SpendIQ runs the right-sizing rules on save. If one fires, a recommendation appears straight away.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.filter(({ form }) => form.department && workspaceIncludesDepartment(state.workspace, form.department)).map((ex) => (
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
            <Field id="res-name" label="Resource name" error={errors.name}>
              <Input
                id="res-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. dc-loadtest-runner-03"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!errors.name}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provider" error={errors.provider}>
                <Select
                  value={form.provider || null}
                  onValueChange={(v) => {
                    if (!v) return
                    set("provider", v as CloudProvider)
                  }}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.provider} aria-label="Provider">
                    <SelectValue>
                      {(v: string | null) =>
                        v ? (
                          <span className="flex items-center gap-2">
                            <BrandLogo brand={v} size="xs" />
                            {v}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select provider</span>
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        <BrandLogo brand={p} size="xs" />
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="res-type" label="Service type" error={errors.type}>
                <Input
                  id="res-type"
                  list="res-type-options"
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  placeholder={typeOptions[0] ? `e.g. ${typeOptions[0]}` : "Choose a provider first"}
                  aria-invalid={!!errors.type}
                />
                <datalist id="res-type-options">
                  {typeOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
            </div>
            <SuggestionChips options={typeOptions} value={form.type} onPick={(v) => set("type", v)} label="Common types:" />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Environment" error={errors.environment}>
                <Select value={form.environment || null} onValueChange={(v) => v && set("environment", v as Environment)}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.environment} aria-label="Environment">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((env) => (
                      <SelectItem key={env} value={env}>
                        {env}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="res-region" label="Region" error={errors.region}>
                <Input
                  id="res-region"
                  list="res-region-options"
                  value={form.region}
                  onChange={(e) => set("region", e.target.value)}
                  placeholder={regionOptions[0] ? `e.g. ${regionOptions[0]}` : "e.g. af-south-1"}
                  aria-invalid={!!errors.region}
                />
                <datalist id="res-region-options">
                  {regionOptions.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field id="res-size" label="Size or tier" error={errors.size}>
                <Input
                  id="res-size"
                  value={form.size}
                  onChange={(e) => set("size", e.target.value)}
                  placeholder="e.g. c6i.4xlarge"
                  className="font-mono"
                  aria-invalid={!!errors.size}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Department" error={errors.department}>
                <Select value={form.department || null} onValueChange={(v) => v && set("department", v as Department)}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.department} aria-label="Department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="res-vcpu" label="vCPU" error={errors.vcpu}>
                <NumberInput id="res-vcpu" value={form.vcpu} onChange={(v) => set("vcpu", v)} step="1" invalid={!!errors.vcpu} />
              </Field>
              <Field id="res-mem-gb" label="Memory" error={errors.memoryGb}>
                <NumberInput
                  id="res-mem-gb"
                  value={form.memoryGb}
                  onChange={(v) => set("memoryGb", v)}
                  suffix="GB"
                  invalid={!!errors.memoryGb}
                />
              </Field>
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="res-has-metrics" className="text-sm">
                    Has CPU/memory metrics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Turn off for storage and platform services. Right-sizing rules then do not apply.
                  </p>
                </div>
                <Switch
                  id="res-has-metrics"
                  checked={form.hasMetrics}
                  onCheckedChange={(checked) => {
                    setForm((f) => ({ ...f, hasMetrics: checked }))
                    setErrors((e) => ({ ...e, cpu: undefined, memory: undefined, vcpu: undefined, memoryGb: undefined }))
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="res-cpu" label="Avg CPU (30 days)" error={errors.cpu}>
                  <NumberInput
                    id="res-cpu"
                    value={form.hasMetrics ? form.cpu : ""}
                    onChange={(v) => set("cpu", v)}
                    suffix="%"
                    disabled={!form.hasMetrics}
                    placeholder={form.hasMetrics ? undefined : "n/a"}
                    invalid={!!errors.cpu}
                  />
                </Field>
                <Field id="res-mem" label="Avg memory (30 days)" error={errors.memory}>
                  <NumberInput
                    id="res-mem"
                    value={form.hasMetrics ? form.memory : ""}
                    onChange={(v) => set("memory", v)}
                    suffix="%"
                    disabled={!form.hasMetrics}
                    placeholder={form.hasMetrics ? undefined : "n/a"}
                    invalid={!!errors.memory}
                  />
                </Field>
                <Field id="res-cost" label="Monthly cost" error={errors.monthlyCost}>
                  <MoneyInput
                    id="res-cost"
                    value={form.monthlyCost}
                    onChange={(v) => set("monthlyCost", v)}
                    suffix="/mo"
                    invalid={!!errors.monthlyCost}
                  />
                </Field>
              </div>

              <RulePreview preview={preview} />
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add resource</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RulePreview({ preview }: { preview: Preview }) {
  const { money } = useMoney()
  const flagged = preview.kind === "flagged"
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-md border px-3 py-2.5",
        flagged ? "border-amber-500/30 bg-amber-500/10" : "border-dashed bg-muted/40",
      )}
    >
      <p className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">Rule preview</p>
      {preview.kind === "flagged" ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <HugeiconsIcon icon={Alert02Icon} size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{preview.rule.category}</p>
              <p className="text-xs text-muted-foreground">
                {preview.rule.test} → {preview.rule.config}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
              {money(preview.saving)}/mo
            </p>
            <p className="text-[11px] text-muted-foreground">projected saving</p>
          </div>
        </div>
      ) : preview.kind === "healthy" ? (
        <p className="flex items-center gap-2 text-sm">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-600 dark:text-emerald-400" />
          Healthy — no action
        </p>
      ) : preview.kind === "no-metrics" ? (
        <p className="text-sm text-muted-foreground">No metrics, so no right-sizing rule applies. Saved as a platform service.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Enter environment, CPU and memory to see which rule fires.</p>
      )}
    </div>
  )
}
