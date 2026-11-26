"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AnalyticsUpIcon,
  DatabaseRestoreIcon,
  LayoutAlignLeftIcon,
  Logout03Icon,
  Settings02Icon,
  UnfoldMoreIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ResetDemoDialog } from "@/components/settings/reset-demo-dialog"
import { savings } from "@/lib/store/selectors"
import { useSpend } from "@/lib/store/spend-store"
import { NAV_GROUPS, isActive } from "./nav"

const ITEM_CLASS =
  "h-8 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-brand group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-0.5 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:w-9! group-data-[collapsible=icon]:min-w-9! group-data-[collapsible=icon]:max-w-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&_span]:hidden [&_svg]:size-[15px]! [&_svg]:text-foreground"

const badgeText = (count: number) => (count > 99 ? "99+" : String(count))

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSpend()
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar()
  const pending = savings(state).pendingCount
  const collapsed = !isMobile && sidebarState === "collapsed"
  const [resetOpen, setResetOpen] = useState(false)

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-0! bg-transparent">
      <SidebarHeader className="shrink-0 gap-2 p-2 pb-1 group-data-[collapsible=icon]:px-0">
        <div className="flex h-10 items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/"
            aria-label="SpendIQ home"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HugeiconsIcon icon={AnalyticsUpIcon} size={17} strokeWidth={2} />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block font-heading text-sm font-semibold tracking-[-0.01em] text-foreground">SpendIQ</span>
              <span className="block truncate text-[11px] text-muted-foreground">NCBA Hackathon · Tech &amp; Cloud Ops</span>
            </span>
          </Link>
          <SidebarCollapseTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent className="min-h-0 justify-start gap-3 overflow-y-auto pt-2">
        <nav aria-label="Main navigation" className="flex flex-col gap-3">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label} className="px-2 py-0 group-data-[collapsible=icon]:px-0">
              <SidebarGroupLabel className="h-6 px-3 text-xs font-medium text-sidebar-foreground/55">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href, pathname)
                    const count = item.badge === "pending" ? pending : 0
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          tooltip={count > 0 ? `${item.label} · ${count} pending` : item.label}
                          isActive={active}
                          className={count > 0 ? `${ITEM_CLASS} pr-9` : ITEM_CLASS}
                          render={
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              onClick={() => {
                                if (isMobile) setOpenMobile(false)
                              }}
                            >
                              <HugeiconsIcon icon={item.icon} size={15} strokeWidth={1.7} />
                              <span>{item.label}</span>
                            </Link>
                          }
                        />
                        {count > 0 ? (
                          <SidebarMenuBadge
                            aria-label={`${count} pending recommendations`}
                            className="top-1.5 bg-amber-500/15 font-mono text-[11px] text-amber-700 dark:text-amber-400"
                          >
                            {badgeText(count)}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none data-popup-open:bg-sidebar-accent group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:p-0!"
              />
            }
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary group-data-[collapsible=icon]:size-9 font-mono text-[11px] font-semibold text-secondary-foreground">
              JS
            </span>
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-medium">Jeremiah S.</span>
              <span className="block truncate text-xs text-muted-foreground">Cloud Ops Lead</span>
            </span>
            <HugeiconsIcon
              icon={UnfoldMoreIcon}
              size={14}
              strokeWidth={1.8}
              className="shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" sideOffset={6} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium text-foreground">Jeremiah S.</span>
                <span className="block text-xs text-muted-foreground">Cloud Ops Lead · {state.workspace}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={1.7} />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <HugeiconsIcon icon={Settings02Icon} size={16} strokeWidth={1.7} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetOpen(true)}>
              <HugeiconsIcon icon={DatabaseRestoreIcon} size={16} strokeWidth={1.7} />
              Reset demo data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => toast("Demo workspace — sign-out disabled")}
            >
              <HugeiconsIcon icon={Logout03Icon} size={16} strokeWidth={1.7} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ResetDemoDialog open={resetOpen} onOpenChange={setResetOpen} />
      </SidebarFooter>
    </Sidebar>
  )
}

/** Collapses the sidebar from inside it. Hidden in icon mode; the header shows the reopen control. */
function SidebarCollapseTrigger() {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Collapse navigation"
      title="Collapse navigation (Ctrl+B)"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none group-data-[collapsible=icon]:hidden"
    >
      <HugeiconsIcon icon={LayoutAlignLeftIcon} size={17} strokeWidth={1.8} />
    </button>
  )
}
