/** spec 022: crypto.randomUUID polyfill (HTTP 部署也能用)
 *
 * crypto.randomUUID() 是 secure context API, 只在 HTTPS / localhost / 127.0.0.1
 * 下可用; HTTP 部署 (例: http://1.2.3.4) 时 window.crypto.randomUUID 为 undefined,
 * 调用会抛 "crypto.randomUUID is not a function"。
 *
 * 这个 polyfill 优先用原生, fallback 到 RFC4122 v4 兼容实现。
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  // RFC4122 v4 fallback
  // 优先用 crypto.getRandomValues (任何 context 都有), 退化才用 Math.random
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // 设置 version (0100) 和 variant (10xx) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0"))
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
}
