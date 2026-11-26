"use client"

import { useState } from "react"

import { RecommendationDrawer } from "@/components/drawers/recommendation-drawer"
import { RequestDrawer } from "@/components/drawers/request-drawer"
import { ResourceDrawer } from "@/components/drawers/resource-drawer"
import { VendorDrawer } from "@/components/drawers/vendor-drawer"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useSpend, type DrawerTarget } from "@/lib/store/spend-store"

/**
 * The one global drawer. Any screen calls `openDrawer({ kind, id })`; this host
 * renders the matching content component inside a right-hand Sheet.
 */
export function DrawerHost() {
  const { state, closeDrawer } = useSpend()
  const drawer = state.drawer
  // Keep the last target while the sheet animates closed so content does not vanish mid-exit.
  const [shown, setShown] = useState<NonNullable<DrawerTarget> | null>(drawer)
  if (drawer && drawer !== shown) setShown(drawer)
  const target = drawer ?? shown
  const isRequest = target?.kind === "request"

  return (
    <Sheet
      open={drawer !== null}
      onOpenChange={(open) => {
        if (!open) closeDrawer()
      }}
    >
      <SheetContent
        side="right"
        resizable
        defaultWidth={isRequest ? 960 : 720}
        minWidth={440}
        storageKey={isRequest ? "spendiq-drawer-w-request" : "spendiq-drawer-w-detail"}
        className="w-full gap-0 overflow-hidden p-0"
      >
        {target ? <DrawerBody key={`${target.kind}:${target.id}`} target={target} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ target }: { target: NonNullable<DrawerTarget> }) {
  switch (target.kind) {
    case "recommendation":
      return <RecommendationDrawer id={target.id} />
    case "resource":
      return <ResourceDrawer id={target.id} />
    case "vendor":
      return <VendorDrawer id={target.id} />
    case "request":
      return <RequestDrawer id={target.id} />
  }
}
