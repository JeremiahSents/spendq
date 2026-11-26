/**
 * The backend snapshot the app starts from.
 *
 * Built from the fixtures the backend exported (`python -m scripts.export_fixtures`),
 * so the demo runs with no server. When NEXT_PUBLIC_API_URL is set, the store
 * replaces this with live data on load (see `loadBackendSnapshot`).
 */
import actions from "./mock/actions.json"
import contracts from "./mock/contracts.json"
import findings from "./mock/findings.json"
import summary from "./mock/summary.json"
import { api } from "./client"
import type { BackendSnapshot } from "./adapter"
import type { Action, Contract, Finding } from "./types"

export const API_URL = process.env.NEXT_PUBLIC_API_URL

export const fixtureSnapshot: BackendSnapshot = {
  usdToKes: summary.usd_to_kes,
  contracts: contracts as unknown as Contract[],
  findings: findings as unknown as Finding[],
  actions: actions as unknown as Action[],
}

/** Live data from the API, or null when no API is configured. */
export async function loadBackendSnapshot(): Promise<BackendSnapshot | null> {
  if (!API_URL) return null
  const [s, c, f, a] = await Promise.all([api.summary(), api.contracts(), api.findings(), api.actions()])
  return { usdToKes: s.usd_to_kes, contracts: c, findings: f, actions: a }
}
