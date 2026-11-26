"use client"

import { toast } from "sonner"

import { perMonth } from "@/lib/format"
import { recSavings } from "./selectors"
import { useSpend } from "./spend-store"

/**
 * Approve / Dismiss with a toast and Undo. Every Approve or Dismiss button in
 * the app goes through this so behaviour and wording stay identical.
 */
export function useRecActions() {
  const { state, approveRecommendation, dismissRecommendation, resetRecommendation } = useSpend()

  return {
    approve(id: string) {
      const rec = state.recommendations.find((r) => r.id === id)
      if (!rec) return
      approveRecommendation(id)
      toast.success("Recommendation approved", {
        description: `${rec.title} · ${perMonth(recSavings(rec))} projected savings`,
        action: { label: "Undo", onClick: () => resetRecommendation(id) },
      })
    },
    dismiss(id: string) {
      const rec = state.recommendations.find((r) => r.id === id)
      if (!rec) return
      dismissRecommendation(id)
      toast("Recommendation dismissed", {
        description: rec.title,
        action: { label: "Undo", onClick: () => resetRecommendation(id) },
      })
    },
  }
}
