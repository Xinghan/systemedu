"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export function AppHeader({ title }: { title?: string }) {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white/80 dark:bg-card/80 backdrop-blur-sm px-8 sticky top-0 z-10">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      {title && <h1 className="text-base font-semibold text-foreground">{title}</h1>}
    </header>
  )
}
