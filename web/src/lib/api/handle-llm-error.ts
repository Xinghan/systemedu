/** spec 017/019: 统一处理 LLM_NOT_CONFIGURED / TTS_NOT_CONFIGURED 错误，
 * 弹 toast 引导用户去 /config。 */

import { toast } from "sonner"
import { ApiError } from "./client"

/** 检测错误是否是 412 LLM_NOT_CONFIGURED 或 TTS_NOT_CONFIGURED；
 * 是则弹引导 toast 并返回 true。
 *
 * 调用方在 catch 里这样用:
 *
 *   try { await gateway.xxx() } catch (e) {
 *     if (handleLLMError(e)) return  // 已处理
 *     // 其他错误...
 *   }
 */
export function handleLLMError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false

  let msg: string | null = null
  if (err.code === "LLM_NOT_CONFIGURED") {
    msg = "请先在 设置 → LLM 里配置 API Key"
  } else if (err.code === "TTS_NOT_CONFIGURED") {
    msg = "请先在 设置 → TTS 里配置 API Key"
  }
  if (!msg) return false

  toast.error(msg, {
    action: {
      label: "去设置",
      onClick: () => {
        if (typeof window !== "undefined") {
          window.location.href = "/config"
        }
      },
    },
    duration: 8000,
  })
  return true
}
