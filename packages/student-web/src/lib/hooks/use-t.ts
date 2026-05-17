/** useT — 简单 hook 包装 t() 函数 (将来可加 store reactive)。
 *
 * key 类型放宽到 string, 兼容老 web 组件传的任意 key (如 chat.neural_engine);
 * 没翻译的 key 在 i18n.ts 里会 fallback 到 key 本身。
 */

import { t } from "@/lib/i18n"

export function useT() {
  return (key: string, vars?: Record<string, string | number>) =>
    t(key as never, vars)
}
