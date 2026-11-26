"use client"

import { useState } from "react"
import { Cell, Pie, PieChart } from "recharts"

import { BrandLogo } from "@/components/shared/brand-logo"
import { SectionCard } from "@/components/shared/dashboard-ui"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { CloudProvider } from "@/lib/data/types"
import { pct } from "@/lib/format"
import { spendByProvider } from "@/lib/store/selectors"
import { useMoney, useSpend } from "@/lib/store/spend-store"
import { cn } from "@/lib/utils"

const CLOUD_PROVIDERS = new Set<string>(["AWS", "Azure", "DigitalOcean", "Vercel", "Neon"] satisfies CloudProvider[])

/** Cloud slices in blues, vendor slices in warm neutrals, so the split reads at a glance. */
const CLOUD_PALETTE = [
  { light: "#39B3E5", dark: "#39B3E5" },
  { light: "#0B7FAB", dark: "#1C9BD0" },
  { light: "#7CCFF0", dark: "#7CCFF0" },
  { light: "#055A7A", dark: "#B3E4F7" },
  { light: "#A9DFF5", dark: "#0B7FAB" },
]
const VENDOR_PALETTE = [
  { light: "#38302E", dark: "#E4DCD8" },
  { light: "#6B5E5A", dark: "#C9BFBB" },
  { light: "#9C8F8A", dark: "#A89C97" },
  { light: "#C9BFBB", dark: "#857873" },
  { light: "#DDD5D1", dark: "#665A56" },
  { light: "#B3A6A1", dark: "#978A85" },
  { light: "#E9E3E0", dark: "#4D4340" },
]
const OTHER_COLOR = { light: "#d4d4d4", dark: "#525252" }

const TOP = 7

type Slice = {
  key: string
  name: string
  value: number
  share: number
  kind: "cloud" | "vendor" | "other"
  theme: { light: string; dark: string }
}

function buildSlices(all: { name: string; value: number }[]) {
  const total = all.reduce((s, r) => s + r.value, 0)
  const config: ChartConfig = {}
  const slices: Slice[] = []
  let c = 0
  let v = 0
  all.slice(0, TOP).forEach((r, i) => {
    const kind = CLOUD_PROVIDERS.has(r.name) ? "cloud" : "vendor"
    const theme = kind === "cloud" ? CLOUD_PALETTE[c++ % CLOUD_PALETTE.length] : VENDOR_PALETTE[v++ % VENDOR_PALETTE.length]
    const key = `s${i}`
    config[key] = { label: r.name, theme }
    slices.push({ key, name: r.name, value: r.value, share: (r.value / total) * 100, kind, theme })
  })
  const rest = all.slice(TOP)
  if (rest.length) {
    const value = rest.reduce((s, r) => s + r.value, 0)
    config.other = { label: `Other (${rest.length})`, theme: OTHER_COLOR }
    slices.push({ key: "other", name: `Other (${rest.length})`, value, share: (value / total) * 100, kind: "other", theme: OTHER_COLOR })
  }
  return { total, slices, config }
}

export function ProviderBreakdownChart() {
  const { money } = useMoney()
  const { state } = useSpend()
  const all = spendByProvider(state)
  const { total, slices, config } = buildSlices(all)
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <SectionCard
      title="Spend by provider"
      description="Monthly run-rate"
    >
      <div className="@container">
        <div className="grid items-center gap-4 @md:grid-cols-[200px_minmax(0,1fr)]">
          <div className="relative mx-auto h-[200px] w-[200px]">
            <ChartContainer config={config} className="aspect-square h-[200px] w-[200px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(_value, _name, item) => {
                        const s = item.payload as Slice
                        return (
                          <div className="flex w-full items-center gap-2">
                            <Swatch theme={s.theme} />
                            <span className="font-medium">{s.name}</span>
                            <span className="ml-auto pl-3 font-mono tabular-nums">
                              {money(s.value)}/mo · {pct(s.share, 1)}
                            </span>
                          </div>
                        )
                      }}
                    />
                  }
                />
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="85%"
                  paddingAngle={1.5}
                  cornerRadius={3}
                  strokeWidth={0}
                  onMouseLeave={() => setHovered(null)}
                >
                  {slices.map((s) => (
                    <Cell
                      key={s.key}
                      fill={`var(--color-${s.key})`}
                      fillOpacity={hovered && hovered !== s.key ? 0.3 : 1}
                      onMouseEnter={() => setHovered(s.key)}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold tabular-nums">{money(total, { compact: true })}</span>
              <span className="text-[11px] text-muted-foreground">per month</span>
            </div>
          </div>

          <ul className="grid gap-0.5">
            {slices.map((s) => (
              <li
                key={s.key}
                onMouseEnter={() => setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-opacity",
                  hovered === s.key && "bg-muted/60",
                  hovered && hovered !== s.key && "opacity-50",
                )}
              >
                <Swatch theme={s.theme} />
                {s.kind === "other" ? (
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-muted font-mono text-[10px] text-muted-foreground">
                    +
                  </span>
                ) : (
                  <BrandLogo brand={s.name} size="xs" />
                )}
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="font-mono tabular-nums">{money(s.value)}/mo</span>
                <span className="w-11 text-right font-mono text-muted-foreground tabular-nums">{pct(s.share, 1)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  )
}

/** The legend sits outside ChartContainer's CSS-variable scope, so it draws both theme colours. */
function Swatch({ theme }: { theme: { light: string; dark: string } }) {
  return (
    <>
      <span className="size-2 shrink-0 rounded-[2px] dark:hidden" style={{ backgroundColor: theme.light }} />
      <span className="hidden size-2 shrink-0 rounded-[2px] dark:block" style={{ backgroundColor: theme.dark }} />
    </>
  )
}
