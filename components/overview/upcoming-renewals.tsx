"use client"

import Link from "next/link"

import { BrandLogo } from "@/components/shared/brand-logo"
import { EmptyState, SectionCard, ToneBadge } from "@/components/shared/dashboard-ui"
import { Button } from "@/components/ui/button"
import { money, shortDate } from "@/lib/format"
import { upcomingRenewals } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { ListDivider, ListRow } from "./list-row"

const WINDOW = 120

export function UpcomingRenewals() {
  const { state, openDrawer } = useSpend()
  const renewals = upcomingRenewals(state, WINDOW)
  const annual = renewals.reduce((s, r) => s + r.annual, 0)

  return (
    <SectionCard
      title="Upcoming vendor renewals"
      description={`Next ${WINDOW} days · ${money(annual)} annual contract value`}
      action={
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link href="/vendors" />}>
          View all
        </Button>
      }
    >
      {renewals.length === 0 ? (
        <EmptyState title="No renewals in the next 120 days" />
      ) : (
        <ListDivider>
          {renewals.map(({ vendor, days, annual }) => (
            <ListRow key={vendor.id} label={`Open ${vendor.name}`} onOpen={() => openDrawer({ kind: "vendor", id: vendor.id })}>
              <BrandLogo brand={vendor.brand} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{vendor.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {vendor.plan} · renews <span className="font-mono tabular-nums">{shortDate(vendor.renewalDate)}</span>
                  {vendor.autoRenew ? " · auto-renew" : " · manual renewal"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-medium tabular-nums">
                  {money(annual)}
                  <span className="text-xs text-muted-foreground">/yr</span>
                </p>
                <ToneBadge tone={days < 30 ? "negative" : days < 60 ? "warning" : "neutral"}>
                  <span className="font-mono tabular-nums">{days}d left</span>
                </ToneBadge>
              </div>
            </ListRow>
          ))}
        </ListDivider>
      )}
    </SectionCard>
  )
}
