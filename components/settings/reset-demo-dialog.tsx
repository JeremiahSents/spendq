"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSpend } from "@/lib/store/spend-store"

export type DemoDataMode = "demo" | "blank"

/** Confirm step for switching between a blank workspace and the seeded demo dataset. */
export function ResetDemoDialog({
  open,
  onOpenChange,
  mode = "demo",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: DemoDataMode
}) {
  const { resetDemo, clearWorkspace } = useSpend()

  function confirm() {
    if (mode === "blank") {
      clearWorkspace()
      onOpenChange(false)
      toast.success("Workspace cleared — ready to present from scratch", {
        action: {
          label: "Load demo data",
          onClick: () => {
            resetDemo()
            toast.success("NCBA demo data loaded")
          },
        },
      })
      return
    }
    resetDemo()
    onOpenChange(false)
    toast.success("Demo reset to starting data")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "blank" ? "Clear all starting data?" : "Restore the starting data?"}</DialogTitle>
          <DialogDescription>
            {mode === "blank"
              ? "Removes all cloud resources, vendors, purchase requests, recommendations and anomalies so you can build live from zero. You can load the demo dataset back at any time."
              : "Restores the full NCBA demo dataset and clears every approval, dismissal and custom item saved in this browser."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant={mode === "blank" ? "destructive" : "default"} onClick={confirm}>
            {mode === "blank" ? "Start blank" : "Load demo data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
