"use client"

import { useEffect } from "react"
import { Languages } from "lucide-react"
import { useLocaleStore } from "@/lib/i18n/store"

/** 全局语言切换器 (中/EN) — 顶栏用。改 store → 全站 reactive。 */
export function LangSwitch() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const hydrate = useLocaleStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        border: "1px solid var(--border-2)",
        borderRadius: 999,
        background: "var(--card)",
      }}
    >
      <Languages size={13} strokeWidth={1.5} style={{ color: "var(--sub-2)", margin: "0 3px" }} />
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "3px 9px",
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            background: locale === l ? "var(--ink)" : "transparent",
            color: locale === l ? "#fff" : "var(--sub)",
            transition: "background var(--t-fast), color var(--t-fast)",
          }}
        >
          {l === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  )
}
