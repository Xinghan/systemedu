"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, type ReactNode } from "react"
import { getToken } from "@/lib/auth"
import { fetchLightkurveKit, lightkurveCourseLink, LIGHTKURVE_COURSE } from "@/lib/lightkurve-course-links"

export function LightkurveMaterialLink({href, children}: {href: string; children: ReactNode}) {
  const search = useSearchParams(), target = lightkurveCourseLink(href)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  if (!target) return <a href={href}>{children}</a>
  if (target.kind === "lesson") return <Link className="text-primary underline" href={target.href + (search.get("mission") === "space" ? `${target.href.includes("?") ? "&" : "?"}mission=space` : "")}>{children}</Link>
  async function download() {
    const token = getToken()
    if (!token) {setError("请先登录并加入原课程，再下载正式实践包。"); return}
    setBusy(true);setError("")
    try {
      const url = URL.createObjectURL(await fetchLightkurveKit(token))
      const anchor = document.createElement("a")
      anchor.href = url;anchor.download = "lightkurve-practice-kit.zip";anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {setError(e instanceof Error ? e.message : "下载未完成，请重试。")}
    finally {setBusy(false)}
  }
  return <span><button type="button" className="text-primary underline disabled:opacity-50" disabled={busy} onClick={() => void download()}>{busy ? "正在读取实践包…" : children}</button>{error && <span role="status" className="block text-sm">{error} <Link className="underline" href={`/library/${LIGHTKURVE_COURSE}`}>查看原课程</Link></span>}</span>
}
