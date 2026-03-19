"use client"

import { AnimateIn } from "./shared-animations"
import type { TimelineData } from "./types"

export function TimelineTemplate({ data }: { data: TimelineData }) {
  const events = data.events ?? []

  if (events.length === 0) return null

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-muted-foreground/20" />

      <div className="space-y-4">
        {events.map((event, i) => (
          <AnimateIn key={i} delay={i * 200}>
            <div className="relative">
              {/* Dot on timeline */}
              <div className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-background" />

              <div className="border rounded-lg p-3 ml-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {event.time}
                  </span>
                  <span className="text-sm font-medium">{event.title}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {event.description}
                </p>
              </div>
            </div>
          </AnimateIn>
        ))}
      </div>
    </div>
  )
}
