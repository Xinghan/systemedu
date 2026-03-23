"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

export function AppHeader({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <header className="flex h-16 items-center gap-4 bg-background/80 backdrop-blur-md px-6 sticky top-0 z-10 shadow-[0_1px_0_0_var(--border)]">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
      {title && (
        <h1 className="text-base font-semibold text-foreground tracking-tight">{title}</h1>
      )}
      {children && <div className="ml-auto flex items-center gap-3">{children}</div>}
    </header>
  )
}
