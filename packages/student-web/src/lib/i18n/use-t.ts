/** useT — 订阅全局 locale store 的翻译 hook。
 *
 * locale 变化 → 所有调用 useT 的组件自动重渲 (zustand selector 订阅)。
 * 调用签名与旧版兼容: const t = useT(); t("nav.home"); t("home.knode_count", { n: 5 })。
 */

"use client"

import { useLocaleStore } from "./store"
import { tables } from "./locales"

export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: string, vars?: Record<string, string | number>) => {
    let s = tables[locale][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
      }
    }
    return s
  }
}

/** 读当前 locale (reactive)。供首页等需要直接拿 locale 值的组件用。 */
export function useLocale() {
  return useLocaleStore((s) => s.locale)
}
