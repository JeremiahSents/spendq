"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Label, control and inline error, matching the purchase-request dialog. */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id?: string
  label: string
  error?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** Numeric input with an optional mono prefix ($) and suffix (%, GB, /mo). */
export function NumberInput({
  id,
  value,
  onChange,
  prefix,
  suffix,
  invalid,
  disabled,
  step = "any",
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  invalid?: boolean
  disabled?: boolean
  step?: string
  placeholder?: string
}) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-xs text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("font-mono tabular-nums", prefix && "pl-6", suffix && (suffix.length > 4 ? "pr-15" : suffix.length > 2 ? "pr-11" : "pr-8"))}
        aria-invalid={invalid}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

/** Small toggle-like chips under a free-text field. */
export function SuggestionChips({
  options,
  value,
  onPick,
  label = "Suggestions:",
}: {
  options: readonly string[]
  value: string
  onPick: (value: string) => void
  label?: string
}) {
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={cn(
            "rounded-md border px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground",
            value === o && "border-foreground/30 bg-muted text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/** Parse a form string as a finite number, or null. */
export function num(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Dialog shell classes: full-width with a scrolling body on phones. */
export const FORM_DIALOG_CLASS =
  "flex max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-4rem)] sm:max-w-2xl"
