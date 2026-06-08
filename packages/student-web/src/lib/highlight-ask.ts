/**
 * 高亮"深入学习"的纯逻辑 (与 DOM 解耦, 便于测试)。spec 2026-06-08。
 */

export const MIN_HIGHLIGHT = 4
export const MAX_HIGHLIGHT = 500

/** 选区文本是否够格弹"深入学习" (trim 后 >= MIN_HIGHLIGHT)。 */
export function isValidSelection(raw: string): boolean {
  return raw.trim().length >= MIN_HIGHLIGHT
}

/** 组装发给 tutor 的解释消息 (过长截断到 MAX_HIGHLIGHT)。 */
export function buildAskMessage(raw: string): string {
  const t = raw.trim().slice(0, MAX_HIGHLIGHT)
  return `请帮我解释这段课文的含义："${t}"。用我能听懂的方式讲清它说的是什么、为什么重要。`
}
