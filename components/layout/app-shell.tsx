"use client"

import type { CSSProperties, ReactNode } from "react"

import { CopilotDrawer } from "@/components/copilot/copilot-drawer"
import { DrawerHost } from "@/components/drawers/drawer-host"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SpendProvider, useSpend } from "@/lib/store/spend-store"
import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

function WorkspaceCopilot() {
  const { state } = useSpend()
  return <CopilotDrawer key={state.workspace} />
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SpendProvider>
      <SidebarProvider
        className="min-h-dvh w-full bg-sidebar"
        style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "4rem" } as CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <AppHeader />
          <div id="main-content" className="flex w-full min-w-0 flex-1 flex-col gap-5 px-4 pt-2 pb-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </SidebarInset>
        <DrawerHost />
        <WorkspaceCopilot />
      </SidebarProvider>
    </SpendProvider>
  )
}
