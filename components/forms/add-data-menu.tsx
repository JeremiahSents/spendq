"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowDown01Icon, CloudIcon, ContractsIcon, ShoppingCart01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { AddResourceDialog } from "./add-resource-dialog"
import { AddVendorDialog } from "./add-vendor-dialog"

type IconData = typeof Add01Icon

function MenuRow({ icon, title, description }: { icon: IconData; title: string; description: string }) {
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center self-start rounded-md border bg-muted/50">
        <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-4" />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </>
  )
}

/** Primary "Add data" button: create a resource, vendor contract or purchase request live. */
export function AddDataMenu() {
  const router = useRouter()
  const [dialog, setDialog] = React.useState<"resource" | "vendor" | null>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Add data
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Add to this workspace</DropdownMenuLabel>
            <DropdownMenuItem className="items-start gap-2.5 py-1.5" onClick={() => setDialog("resource")}>
              <MenuRow icon={CloudIcon} title="Cloud resource" description="A VM, database or service. Right-sizing rules run on save." />
            </DropdownMenuItem>
            <DropdownMenuItem className="items-start gap-2.5 py-1.5" onClick={() => setDialog("vendor")}>
              <MenuRow icon={ContractsIcon} title="Vendor contract" description="A SaaS licence. Unused seats are flagged on save." />
            </DropdownMenuItem>
            <DropdownMenuItem className="items-start gap-2.5 py-1.5" onClick={() => router.push("/procurement?new=1")}>
              <MenuRow
                icon={ShoppingCart01Icon}
                title="Purchase request"
                description="Cost-checked against inventory before approval."
              />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddResourceDialog open={dialog === "resource"} onOpenChange={(o) => setDialog(o ? "resource" : null)} />
      <AddVendorDialog open={dialog === "vendor"} onOpenChange={(o) => setDialog(o ? "vendor" : null)} />
    </>
  )
}
