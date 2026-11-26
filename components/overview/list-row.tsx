"use client"

import type { KeyboardEvent, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A dense, clickable list row. Uses a div with button semantics so rows can
 * hold their own inline buttons (e.g. Approve) without nesting <button>s.
 */
export function ListRow({
  onOpen,
  label,
  children,
  className,
}: {
  onOpen: () => void
  label: string
  children: ReactNode
  className?: string
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onOpen()
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        "-mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ListDivider({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/70">{children}</div>
}
