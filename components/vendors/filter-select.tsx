"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Compact select whose "all" option shows a readable placeholder label. */
export function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  className?: string
}) {
  const labelFor = (v: string) => (v === "all" ? allLabel : (options.find((o) => o.value === v)?.label ?? v))
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string | null) ?? "all")}>
      <SelectTrigger size="sm" className={className} aria-label={allLabel}>
        <SelectValue>{(v: string) => labelFor(v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
