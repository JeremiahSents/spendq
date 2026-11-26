"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Database02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { BrandLogo } from "@/components/shared/brand-logo"
import { PageHeader, ToneBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Integration } from "@/lib/data/types"
import { useSpend } from "@/lib/store/spend-store"

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Cloud providers", ids: ["int-aws", "int-azure", "int-do", "int-vercel", "int-neon"] },
  { title: "SaaS & identity", ids: ["int-github", "int-slack", "int-m365"] },
  { title: "Finance", ids: ["int-erp"] },
]

export function IntegrationsView() {
  const { state, toggleIntegration } = useSpend()
  const [synced, setSynced] = useState<Record<string, string>>({})
  const list = state.integrations
  const connected = list.filter((i) => i.connected).length

  const grouped = GROUPS.map((g) => ({
    title: g.title,
    items: g.ids.map((id) => list.find((i) => i.id === id)).filter((i): i is Integration => Boolean(i)),
  }))
  const known = new Set(GROUPS.flatMap((g) => g.ids))
  const other = list.filter((i) => !known.has(i.id))
  if (other.length) grouped.push({ title: "Other", items: other })

  function toggle(i: Integration) {
    toggleIntegration(i.id)
    if (i.connected) {
      setSynced((s) => {
        const next = { ...s }
        delete next[i.id]
        return next
      })
      toast(`${i.name} disconnected`)
    } else {
      toast.success(`${i.name} connected (simulated)`)
    }
  }

  function sync(i: Integration) {
    setSynced((s) => ({ ...s, [i.id]: "Just now" }))
    toast.success("Sync queued — simulated data", { description: i.name })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Data sources SpendIQ reads to build the cost map. Demo connections use simulated data."
        actions={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {connected} of {list.length} connected
          </span>
        }
      />

      {grouped.map((g) => (
        <section key={g.title} className="space-y-2.5">
          <h2 className="font-heading text-sm font-semibold">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((i) => (
              <Card key={i.id} className="min-w-0 gap-3 px-4 py-4">
                <div className="flex items-start gap-3">
                  {i.brand ? (
                    <BrandLogo brand={i.brand} size="md" />
                  ) : (
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      <HugeiconsIcon icon={Database02Icon} size={16} strokeWidth={1.8} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.kind}</p>
                  </div>
                  <ToneBadge tone={i.connected ? "positive" : "neutral"}>
                    {i.connected ? "Connected" : "Not connected"}
                  </ToneBadge>
                </div>
                <p className="text-xs text-muted-foreground">{i.detail}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    Last sync {i.connected ? (synced[i.id] ?? i.lastSync) : "—"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {i.connected ? (
                      <Button variant="outline" size="sm" onClick={() => sync(i)}>
                        Sync now
                      </Button>
                    ) : null}
                    <Button variant={i.connected ? "ghost" : "default"} size="sm" onClick={() => toggle(i)}>
                      {i.connected ? "Disconnect" : "Connect"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Live API connections are out of scope for the hackathon; every connection here reads simulated data.
      </p>
    </div>
  )
}
