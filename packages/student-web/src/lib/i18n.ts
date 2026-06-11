/** 兼容层 — 旧代码从 "@/lib/i18n" 引入 t / Locale / TranslationKey / setLocale。
 *
 * 实际实现已迁到 lib/i18n/ (reactive store + 字典)。此文件保留旧 API 表面,
 * 让已有 import 零改动。组件里优先用 useT() (reactive); 非组件场景用 t()。
 */

import { tables, type Locale, type TranslationKey } from "./i18n/locales"
import { useLocaleStore } from "./i18n/store"

export type { Locale, TranslationKey }

export function setLocale(locale: Locale): void {
  useLocaleStore.getState().setLocale(locale)
}

export function getLocale(): Locale {
  return useLocaleStore.getState().locale
}

/** 非 reactive 取值 (读 store 当前 locale)。组件内请用 useT() 以获得重渲。 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const locale = useLocaleStore.getState().locale
  let s = tables[locale][key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }
  return s
}
