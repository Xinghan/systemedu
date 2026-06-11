/** 全局语言 store — zustand + localStorage 持久化, 让语言切换全站 reactive。
 *
 * SSR 安全: 初始 locale 固定 "zh" (与服务端一致), 客户端挂载后由 hydrate()
 * 从 localStorage 同步真实选择, 避免 hydration mismatch。
 */

import { create } from "zustand"
import type { Locale } from "./locales"

const STORAGE_KEY = "se_locale"

interface LocaleState {
  locale: Locale
  hydrated: boolean
  hydrate: () => void
  setLocale: (locale: Locale) => void
}

function readStored(): Locale | null {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === "zh" || v === "en" ? v : null
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "zh",
  hydrated: false,
  hydrate: () => {
    const stored = readStored()
    set({ locale: stored ?? "zh", hydrated: true })
  },
  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale)
    }
    set({ locale })
  },
}))
