import { HugeiconsIcon } from "@hugeicons/react"
import { AiMagicIcon, BulbIcon, Delete02Icon, Recycle01Icon } from "@hugeicons/core-free-icons"

import { PILLAR_COPY } from "@/lib/store/build"
import type { Pillar } from "@/lib/data/types"
import { PillarBadge } from "@/components/shared/dashboard-ui"

export const PILLAR_ICON: Record<Pillar, typeof Recycle01Icon> = {
  Reuse: Recycle01Icon,
  Innovate: BulbIcon,
  Automate: AiMagicIcon,
  Eliminate: Delete02Icon,
}

const ORDER: Pillar[] = ["Reuse", "Innovate", "Automate", "Eliminate"]

/** "How SpendIQ decides": the four NCBA hackathon pillars, always visible. */
export function PillarStrip() {
  return (
    <section aria-label="How SpendIQ decides" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">How SpendIQ decides</h2>
        <span className="text-xs text-muted-foreground">Every request is checked in this order before it reaches an approver.</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((pillar, i) => (
          <li key={pillar} className="flex min-w-0 items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
              <HugeiconsIcon icon={PILLAR_ICON[pillar]} size={14} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                <PillarBadge pillar={pillar} />
              </div>
              <p className="text-xs leading-snug text-muted-foreground">{PILLAR_COPY[pillar]}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
