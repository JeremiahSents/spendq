import { AiMagicIcon, BulbIcon, Delete02Icon, Recycle01Icon } from "@hugeicons/core-free-icons"

import type { Pillar } from "@/lib/data/types"
import { PillarBadge } from "@/components/shared/dashboard-ui"

export const PILLAR_ICON: Record<Pillar, typeof Recycle01Icon> = {
  Reuse: Recycle01Icon,
  Innovate: BulbIcon,
  Automate: AiMagicIcon,
  Eliminate: Delete02Icon,
}

const STEPS: { pillar: Pillar; hint: string }[] = [
  { pillar: "Reuse", hint: "Spare capacity first" },
  { pillar: "Innovate", hint: "Benchmark alternatives" },
  { pillar: "Automate", hint: "Instant policy checks" },
  { pillar: "Eliminate", hint: "Stop waste pre-PO" },
]

/** Compact 4-step decision bar showing the four NCBA hackathon pillars. */
export function PillarStrip() {
  return (
    <ol aria-label="Decision order" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {STEPS.map(({ pillar, hint }, i) => (
        <li key={pillar} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
          <PillarBadge pillar={pillar} />
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        </li>
      ))}
    </ol>
  )
}
