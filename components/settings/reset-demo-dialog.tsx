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

/** Confirm step for wiping this browser's saved demo state. Controlled so a menu item can open it. */
export function ResetDemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { resetDemo } = useSpend()

  function confirm() {
    resetDemo()
    onOpenChange(false)
    toast.success("Demo reset to starting data")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore the starting data?</DialogTitle>
          <DialogDescription>
            This clears every approval, dismissal and purchase request made in this browser.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={confirm}>
            Reset demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
