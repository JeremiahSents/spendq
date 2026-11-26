"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

const widthListeners = new Set<() => void>()

function subscribeWidth(listener: () => void) {
  widthListeners.add(listener)
  return () => widthListeners.delete(listener)
}

function getStoredWidth(key?: string): number | undefined {
  if (!key || typeof window === "undefined") return undefined
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  } catch {
    return undefined
  }
}

function setStoredWidth(key: string | undefined, value: number | null) {
  if (!key || typeof window === "undefined") return
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // Ignore storage errors in restricted environments.
  }
  widthListeners.forEach((fn) => fn())
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  resizable = false,
  defaultWidth = 640,
  minWidth = 400,
  maxWidthRatio = 0.92,
  storageKey,
  style,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  resizable?: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidthRatio?: number
  storageKey?: string
}) {
  const canResize = resizable && (side === "right" || side === "left")
  const storedWidth = React.useSyncExternalStore(
    subscribeWidth,
    () => (canResize ? getStoredWidth(storageKey) : undefined),
    () => undefined,
  )
  const [dragWidth, setDragWidth] = React.useState<number | null>(null)
  const activeWidth = dragWidth ?? storedWidth ?? defaultWidth

  const clampWidth = React.useCallback(
    (next: number) => {
      const max = typeof window === "undefined" ? 1400 : Math.max(minWidth, Math.floor(window.innerWidth * maxWidthRatio))
      return Math.max(minWidth, Math.min(max, Math.round(next)))
    },
    [minWidth, maxWidthRatio],
  )

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canResize || event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startW = clampWidth(activeWidth)
    let latest = startW
    setDragWidth(startW)

    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const onMove = (moveEvent: PointerEvent) => {
      const delta = side === "right" ? startX - moveEvent.clientX : moveEvent.clientX - startX
      latest = clampWidth(startW + delta)
      setDragWidth(latest)
    }

    const onUp = () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      setStoredWidth(storageKey, latest)
      setDragWidth(null)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  const onHandleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canResize) return
    const step = event.shiftKey ? 64 : 24
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      const grow = side === "right" ? event.key === "ArrowLeft" : event.key === "ArrowRight"
      setStoredWidth(storageKey, clampWidth(activeWidth + (grow ? step : -step)))
    } else if (event.key === "Enter" || event.key === "0") {
      event.preventDefault()
      setStoredWidth(storageKey, null)
    }
  }

  const popupStyle = canResize
    ? ({ ...style, ["--sheet-w" as string]: `${activeWidth}px` } as React.CSSProperties)
    : style

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        style={popupStyle}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          canResize
            ? "w-full sm:w-[min(var(--sheet-w),92vw)] sm:max-w-none"
            : "data-[side=left]:w-3/4 data-[side=right]:w-3/4 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          dragWidth !== null && "transition-none",
          className
        )}
        {...props}
      >
        {canResize ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            tabIndex={0}
            title="Drag to resize · Double-click to reset"
            onPointerDown={startResize}
            onDoubleClick={() => setStoredWidth(storageKey, null)}
            onKeyDown={onHandleKeyDown}
            className={cn(
              "group/resize absolute inset-y-0 z-20 hidden w-2.5 cursor-col-resize touch-none items-center justify-center outline-none select-none sm:flex",
              side === "right" ? "left-0" : "right-0",
            )}
          >
            <span
              className={cn(
                "h-10 w-1 rounded-full bg-border/80 transition-colors group-hover/resize:bg-ring group-focus-visible/resize:bg-ring",
                dragWidth !== null && "h-16 bg-ring",
              )}
            />
          </div>
        ) : null}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
