import { cn } from "@/lib/utils"

/** Small muted marker for items detected by the SpendQ backend engine. */
export function EngineTag({ short, className }: { short?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded border border-dashed px-1 font-mono text-[10px] tracking-wide text-muted-foreground",
        className,
      )}
    >
      {short ? "SpendQ" : "SpendQ engine"}
    </span>
  )
}
