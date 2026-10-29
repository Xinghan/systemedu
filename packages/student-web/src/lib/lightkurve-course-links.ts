import { STUDENT_API_URL } from "./api/client"
import { lessonPath } from "./course-numbering"

export const LIGHTKURVE_COURSE = "lightkurve-transit-detective"
export async function lightkurveFile(relative: string, token: string) {
  if (!token) throw new Error("请先登录原课程后读取资料。")
  if (!relative || relative.startsWith("/") || /[\\\u0000-\u001f]/.test(relative) || relative.split("/").some(part => !part || part === "." || part === "..")) throw new Error("课程资源路径无效")
  const response = await fetch(`${STUDENT_API_URL}/api/my/projects/${LIGHTKURVE_COURSE}/files/${relative.split("/").map(encodeURIComponent).join("/")}`, {
    headers: {Authorization: `Bearer ${token}`, "X-Course-Numbering": "consecutive-v2"}, cache: "no-store",
  })
  if (!response.ok) throw new Error(response.status === 401 ? "请重新登录后读取资料，原学习记录仍保留。" : response.status === 403 || response.status === 404 ? "请先加入原课程，再读取正式资料。" : "资料服务暂时不可用，请稍后重试。")
  return response
}
/** Resolve only known legacy local links; never attach credentials to an arbitrary URL. */
export function lightkurveCourseLink(href: string) {
  if (!href.startsWith("/preview/lightkurve/")) return null
  const url = new URL(href, "http://course.local")
  const match = url.pathname.match(/^\/preview\/lightkurve\/(M(?:0[1-9]|[12]\d|3[0-2]))$/)
  if (match) {
    const query = new URLSearchParams()
    const view = url.searchParams.get("view"), mode = url.searchParams.get("mode")
    if (view && ["lab", "slides", "assignment"].includes(view)) query.set("view", view)
    if (view === "lab" && mode && ["game", "animation"].includes(mode)) query.set("mode", mode)
    return {kind: "lesson" as const, module: match[1], href: lessonPath(LIGHTKURVE_COURSE, match[1]) + (query.size ? `?${query}` : "")}
  }
  if (url.pathname === "/preview/lightkurve/media" && url.searchParams.get("path") === "downloads/lightkurve-practice-kit.zip") return {kind: "download" as const}
  return null
}
export async function fetchLightkurveKit(token: string) {
  const response = await fetch(`${STUDENT_API_URL}/api/my/projects/${LIGHTKURVE_COURSE}/files/downloads/lightkurve-practice-kit.zip`, {
    headers: {Authorization: `Bearer ${token}`, "X-Course-Numbering": "consecutive-v2"},
  })
  if (!response.ok) throw new Error(response.status === 401 ? "请重新登录后下载，原学习记录仍保留。" : response.status === 403 || response.status === 404 ? "请先加入原课程，再下载正式实践包。" : "资料服务暂时不可用，请稍后重试。")
  return response.blob()
}
