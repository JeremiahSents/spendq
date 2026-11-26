import { HugeiconsIcon } from "@hugeicons/react"
import {
  AmazonIcon,
  ClaudeIcon,
  ChatGptIcon,
  FigmaIcon,
  GithubIcon,
  MicrosoftTeamsIcon,
  NotionIcon,
  Office365Icon,
  SlackIcon,
  ZoomIcon,
} from "@hugeicons/core-free-icons"

import type { BrandKey } from "@/lib/data/types"
import { cn } from "@/lib/utils"

type IconData = typeof GithubIcon

const ICONS: Partial<Record<BrandKey, IconData>> = {
  AWS: AmazonIcon,
  GitHub: GithubIcon,
  Slack: SlackIcon,
  "Microsoft 365": Office365Icon,
  "Microsoft Teams": MicrosoftTeamsIcon,
  OpenAI: ChatGptIcon,
  Anthropic: ClaudeIcon,
  Figma: FigmaIcon,
  Notion: NotionIcon,
  Zoom: ZoomIcon,
}

/** Brand tile colours. Text colour is chosen for contrast on the tile. */
const TILE: Record<BrandKey | "SpendIQ", string> = {
  AWS: "bg-[#232F3E] text-[#FF9900]",
  Azure: "bg-[#0078D4] text-white",
  DigitalOcean: "bg-[#0080FF] text-white",
  Vercel: "bg-black text-white dark:bg-white dark:text-black",
  Neon: "bg-[#0B0F0D] text-[#00E599]",
  GitHub: "bg-[#24292F] text-white",
  Slack: "bg-[#4A154B] text-white",
  "Microsoft 365": "bg-[#D83B01] text-white",
  "Microsoft Teams": "bg-[#5059C9] text-white",
  OpenAI: "bg-[#10A37F] text-white",
  Anthropic: "bg-[#D97757] text-white",
  Figma: "bg-[#1E1E1E] text-[#F24E1E]",
  Notion: "bg-white text-black ring-1 ring-border",
  Datadog: "bg-[#632CA6] text-white",
  Zoom: "bg-[#0B5CFF] text-white",
  "New Relic": "bg-[#1CE783] text-[#0B1E29]",
  Grafana: "bg-[#F46800] text-white",
  Confluence: "bg-[#1868DB] text-white",
  Salesforce: "bg-[#00A1E0] text-white",
  Jira: "bg-[#0052CC] text-white",
  Liquid: "bg-[#1B1464] text-white",
  SpendIQ: "bg-primary text-primary-foreground",
}

/** Small hand-drawn marks for brands the free icon set does not carry. */
function CustomMark({ brand }: { brand: BrandKey | "SpendIQ" }) {
  switch (brand) {
    case "Azure":
      return (
        <svg viewBox="0 0 24 24" className="size-[60%]" fill="currentColor" aria-hidden>
          <path d="M9.6 3h5.1L9.3 19.4a.8.8 0 0 1-.8.6H3.7a.8.8 0 0 1-.7-1.1L8.8 3.6A.8.8 0 0 1 9.6 3Z" />
          <path d="M16.7 14.1H8.6a.4.4 0 0 0-.3.7l5.2 4.9c.2.2.4.3.6.3h5.1l-2.5-5.9Z" opacity=".75" />
          <path d="M14.7 3a.8.8 0 0 1 .8.6l5.8 15.3a.8.8 0 0 1-.7 1.1h-5.1a.8.8 0 0 0 .7-1.1L10.4 3.6a.8.8 0 0 0-.8-.6h5.1Z" opacity=".55" />
        </svg>
      )
    case "DigitalOcean":
      return (
        <svg viewBox="0 0 24 24" className="size-[62%]" fill="currentColor" aria-hidden>
          <path d="M12 21v-3.6a5.4 5.4 0 1 0-5.4-5.4H3a9 9 0 1 1 9 9Z" />
          <path d="M12 17.4H8.4v-3.6H12v3.6ZM8.4 20.1H5.6v-2.7h2.8v2.7ZM5.6 17.4H3.3v-2.3h2.3v2.3Z" />
        </svg>
      )
    case "Vercel":
      return (
        <svg viewBox="0 0 24 24" className="size-[55%]" fill="currentColor" aria-hidden>
          <path d="M12 3 22 20H2L12 3Z" />
        </svg>
      )
    case "Neon":
      return (
        <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <path d="M5 20V4l14 13V8" strokeLinejoin="round" />
        </svg>
      )
    case "Datadog":
      return <span className="text-[0.55em] font-bold tracking-tight">DD</span>
    case "New Relic":
      return <span className="text-[0.55em] font-bold tracking-tight">NR</span>
    case "Grafana":
      return <span className="text-[0.6em] font-bold">G</span>
    case "Confluence":
      return <span className="text-[0.6em] font-bold">C</span>
    case "Salesforce":
      return <span className="text-[0.5em] font-bold">SF</span>
    case "Jira":
      return (
        <svg viewBox="0 0 24 24" className="size-[58%]" fill="currentColor" aria-hidden>
          <path d="M21.6 11.4 12.6 2.4 12 1.8 3 10.8l-.6.6a.8.8 0 0 0 0 1.2l6.2 6.2L12 22.2l9-9 .6-.6a.8.8 0 0 0 0-1.2ZM12 15.1 8.9 12 12 8.9l3.1 3.1L12 15.1Z" />
        </svg>
      )
    case "Liquid":
      return <span className="text-[0.6em] font-bold">L</span>
    case "SpendIQ":
      return <span className="text-[0.55em] font-bold">IQ</span>
    default:
      return <span className="text-[0.6em] font-bold">{brand.slice(0, 1)}</span>
  }
}

const SIZES = { xs: "size-5 rounded-[5px] text-[13px]", sm: "size-6 rounded-md text-sm", md: "size-8 rounded-lg text-base", lg: "size-10 rounded-lg text-lg" }

/** Recognizable vendor or cloud mark on its brand tile. */
export function BrandLogo({
  brand,
  size = "sm",
  className,
}: {
  brand: BrandKey | "SpendIQ" | string
  size?: keyof typeof SIZES
  className?: string
}) {
  const key = (brand in TILE ? brand : "SpendIQ") as BrandKey | "SpendIQ"
  const icon = key === "SpendIQ" ? undefined : ICONS[key as BrandKey]
  return (
    <span
      title={String(brand)}
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", SIZES[size], TILE[key], className)}
    >
      {icon ? <HugeiconsIcon icon={icon} strokeWidth={1.8} className="size-[62%]" /> : <CustomMark brand={key} />}
    </span>
  )
}

