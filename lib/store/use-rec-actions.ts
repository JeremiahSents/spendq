"use client"

import { toast } from "sonner"

import { api } from "@/lib/api/client"
import { API_URL } from "@/lib/api/backend-data"
import { evaluateProcurementOption, recommendedPlan } from "@/lib/procurement/policies"
import type { Recommendation } from "@/lib/data/types"
import { savingWording } from "./selectors"
import { useMoney, useSpend } from "./spend-store"

/**
 * Approve / Dismiss with a toast and Undo. Every Approve or Dismiss button in
 * the app goes through this so behaviour and wording stay identical.
 *
 * Recommendations that came from the SpendQ backend (they carry `actionId`)
 * also record the decision through its API when NEXT_PUBLIC_API_URL is set.
 * The API has no "undo", so Undo only reverts the screen for those.
 */
export function useRecActions() {
  const { state, approveRecommendation, dismissRecommendation, resetRecommendation, openDrawer } = useSpend()
  const { moneyText } = useMoney()

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
      if (rec.source === "procurement") {
        const request = state.requests.find((item) => item.id === rec.refId)
        if (!request) return
        const evaluation = evaluateProcurementOption(state, request, recommendedPlan(request))
        if (evaluation.blocked) {
          openDrawer({ kind: "request", id: request.id })
          toast.error(evaluation.reason ?? "This request requires review")
          return
        }
      }
      approveRecommendation(id)
      sync(rec, "approve")
      const wording = savingWording(rec)
      toast.success(wording.kind === "none" ? "Action assigned" : "Recommendation approved", {
        description: wording.kind === "none" ? rec.title : `${rec.title} · ${moneyText(wording.text)}`,
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
