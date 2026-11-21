"use client"

import { useState, type ReactNode } from "react"
import { library } from "@/lib/api"
import { getToken } from "@/lib/auth"

/** Resolve only authored, same-origin library paths, never send credentials to an author-provided host. */
export function courseMaterial(value?: string) {
  const match = value?.match(/^\/api\/library\/projects\/([a-z0-9-]+)\/files\/([A-Za-z0-9._/-]+)$/)
  if (!match || match[2].split("/").some(part => !part || part === "." || part === "..")) return null
  return { url: library.fileUrl(match[1], match[2]), name: match[2].split("/").at(-1)! }
}

export function CourseMaterialLink({ material, children }: {
  material: NonNullable<ReturnType<typeof courseMaterial>>
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function download() {
    setBusy(true)
    setError("")
    try {
      const token = getToken()
      const response = await fetch(material.url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? "请登录并加入这门课程，再打开资料。" : "资料暂时无法读取，请重试。")
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = material.name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "资料暂时无法读取，请重试。")
    } finally { setBusy(false) }
  }
  return <><button type="button" className="text-primary underline" disabled={busy} onClick={() => void download()}>{children}</button>{error && <span role="alert"> {error}</span>}</>
}
