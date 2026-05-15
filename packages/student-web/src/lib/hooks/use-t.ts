/** useT — 简单 hook 包装 t() 函数 (将来可加 store reactive)。 */

import { t, type TranslationKey } from "@/lib/i18n"

export function useT() {
  return (key: TranslationKey, vars?: Record<string, string | number>) => t(key, vars)
}
