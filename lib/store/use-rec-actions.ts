"use client"

import { toast } from "sonner"

import { api } from "@/lib/api/client"
import { API_URL } from "@/lib/api/backend-data"
import type { Recommendation } from "@/lib/data/types"
import { perMonth } from "@/lib/format"
import { recSavings } from "./selectors"
import { useSpend } from "./spend-store"

/**
 * Approve / Dismiss with a toast and Undo. Every Approve or Dismiss button in
 * the app goes through this so behaviour and wording stay identical.
 *
 * Recommendations that came from the SpendQ backend (they carry `actionId`)
 * also record the decision through its API when NEXT_PUBLIC_API_URL is set.
 * The API has no "undo", so Undo only reverts the screen for those.
 */
export function useRecActions() {
  const { state, approveRecommendation, dismissRecommendation, resetRecommendation } = useSpend()

  function sync(rec: Recommendation, decision: "approve" | "reject") {
    if (!rec.actionId || !API_URL) return
    const call = decision === "approve" ? api.approve(rec.actionId) : api.reject(rec.actionId)
    call.catch((error: unknown) => {
      resetRecommendation(rec.id)
      toast.error("SpendQ API rejected the decision", {
        description: error instanceof Error ? error.message : String(error),
      })
    })
  }

  return {
    approve(id: string) {
      const rec = state.recommendations.find((r) => r.id === id)
      if (!rec) return
      approveRecommendation(id)
      sync(rec, "approve")
      toast.success("Recommendation approved", {
        description: `${rec.title} · ${perMonth(recSavings(rec))} projected savings`,
        action: { label: "Undo", onClick: () => resetRecommendation(id) },
      })
    },
    dismiss(id: string) {
      const rec = state.recommendations.find((r) => r.id === id)
      if (!rec) return
      dismissRecommendation(id)
      sync(rec, "reject")
      toast("Recommendation dismissed", {
        description: rec.title,
        action: { label: "Undo", onClick: () => resetRecommendation(id) },
      })
    },
  }
}
