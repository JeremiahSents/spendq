import {
  AiIdeaIcon,
  CloudIcon,
  DashboardSquare01Icon,
  Plug01Icon,
  Settings02Icon,
  ShoppingCart01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"

export type NavIcon = typeof CloudIcon

export interface NavItem {
  href: string
  label: string
  icon: NavIcon
  /** Shows the live pending-recommendation count. */
  badge?: "pending"
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Overview", icon: DashboardSquare01Icon },
      { href: "/cloud", label: "Cloud", icon: CloudIcon },
      { href: "/vendors", label: "Vendors", icon: Store01Icon },
      { href: "/procurement", label: "Procurement", icon: ShoppingCart01Icon },
      { href: "/recommendations", label: "Recommendations", icon: AiIdeaIcon, badge: "pending" },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/integrations", label: "Integrations", icon: Plug01Icon },
      { href: "/settings", label: "Settings", icon: Settings02Icon },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

export function pageTitle(pathname: string) {
  return ALL_ITEMS.find((item) => isActive(item.href, pathname))?.label ?? "Overview"
}
