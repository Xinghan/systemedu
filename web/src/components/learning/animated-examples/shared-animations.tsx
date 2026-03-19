"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/**
 * Hook that detects when an element enters the viewport.
 */
export function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.unobserve(el)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isInView }
}

/**
 * Wrapper that fades + slides in its children when scrolled into view.
 */
export function AnimateIn({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { ref, isInView } = useInView()

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Example section wrapper with title.
 */
export function ExampleSection({
  title,
  index,
  children,
}: {
  title: string
  index: number
  children: ReactNode
}) {
  return (
    <AnimateIn delay={index * 150} className="mb-8 last:mb-0">
      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {index + 1}
        </span>
        {title}
      </h3>
      {children}
    </AnimateIn>
  )
}
