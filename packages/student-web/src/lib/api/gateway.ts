/**
 * spec 027: gateway shim — 学生端把老 web 学习页里写死的 cloud-app endpoint
 * 桥接到 student-app + library API。
 *
 * 设计:
 *  - getCourseV2/V3, getCourseV2Assignment 由 myProjects.getKnode (本地 clone) 提供数据 +
 *    转成老的 CourseContentData / CourseAssignmentData 格式
 *  - 任何"生成 / 重生成 / 评判"接口在学生端是 no-op (返回稳定空值, 让 UI 不爆)
 *  - 进度调用桥到 myProjects.setProgress (学生端进度模型: slug + module_id 字符串,
 *    跟老 cloud-app 的 project_name + nodeId int 对应不上)
 *
 * 这样 CourseContentView / AssignmentView 不需要改, 直接喂数据就能显示。
 * "重新生成本节" / "提交答题统计" 这类按钮在学生端 UX 上也保留, 但实际是 noop。
 */

import { STUDENT_API_URL } from "./client"
import { myProjects, type LibraryKnodeContent } from "./index"
import { getToken } from "@/lib/auth"
import type {
  CourseAssignmentData,
  CourseContentData,
  CourseV3VersionsData,
  ExerciseAttemptPayload,
  PracticeSubmissionResult,
  UpdateProgressResponse,
} from "@/lib/types/api"

// ---------------------------------------------------------------------------
// 适配: LibraryKnodeContent -> CourseContentData (老学习页吃这个 shape)
// ---------------------------------------------------------------------------

async function fetchInlineHtml(slug: string, path: string): Promise<string | null> {
  try {
    const token = getToken()
    // spec 033: 走本地 clone (/api/my/projects/) 而不是 library 代理
    const url = `${STUDENT_API_URL}/api/my/projects/${encodeURIComponent(slug)}/files/${path}`
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function inlineHtmlPaths(
  slug: string,
  knodeDir: string,
  renderedMap: Record<string, unknown>,
): Promise<void> {
  // 把 section.html_path 指向的 HTML 文件 fetch 回来内联到 section.html
  // (老 CourseContentView IdeaBlock 只看 section.html, 不看 html_path)
  const sections = Object.values(renderedMap) as Array<{
    mode?: string
    html?: string | null
    html_path?: string | null
  }>
  await Promise.all(
    sections.map(async (sec) => {
      if (!sec || sec.html) return // 已有 html 直接用
      const path = sec.html_path
      if (!path) return
      if (sec.mode !== "animation" && sec.mode !== "game" && sec.mode !== "diagram") return
      const fullPath = knodeDir ? `${knodeDir}/${path}` : path
      const html = await fetchInlineHtml(slug, fullPath)
      if (html) sec.html = html
    }),
  )
}

function knodeToCourseContent(k: LibraryKnodeContent): CourseContentData {
  const rs = (k.rendered_sections || {}) as {
    ideas?: Array<{ idea_id: string; mode: string; topic?: string; [k: string]: unknown }>
    rendered_sections?: Record<string, unknown>
    story_paragraphs?: string[]
    external_resources?: Record<string, unknown>
  }
  // plan_markdown 里 [[IDEA:xxx]] 占位有时是 idea_id, 有时是 topic
  // CourseContentView.PlanWithIdeas 用 ideas 数组建 Map<idea_id, idea> 查 ideaId
  // 再用 rendered_sections[ideaId] 取 section
  // 所以两边都得加 topic 别名
  const originalIdeas = rs.ideas || []
  const renderedMap: Record<string, unknown> = { ...(rs.rendered_sections || {}) }
  const ideasOut = [...originalIdeas]
  for (const idea of originalIdeas) {
    const id = idea.idea_id as string | undefined
    const topic = idea.topic as string | undefined
    if (id && topic && id !== topic) {
      if (renderedMap[id] && !renderedMap[topic]) {
        renderedMap[topic] = renderedMap[id]
      }
      // 加一条别名 idea entry, idea_id=topic, 其余字段照旧
      if (!ideasOut.some((x) => x.idea_id === topic)) {
        ideasOut.push({ ...idea, idea_id: topic })
      }
    }
  }
  return {
    project_name: k.project_slug,
    knode_id: 0,
    status: "ready",
    version_label: k.version || "v1",
    is_active: true,
    course_content: {
      plan_markdown: k.plan_markdown || "",
      ideas: ideasOut as never,
      rendered_sections: renderedMap as never,
      theories: (k.theories || []) as never,
      external_resources: (rs.external_resources || {}) as never,
    },
  } as unknown as CourseContentData
}

function knodeToAssignment(k: LibraryKnodeContent): CourseAssignmentData {
  return {
    knode_id: 0,
    project_name: k.project_slug,
    assignment_md: k.assignment_md || "",
    status: "ready",
  } as unknown as CourseAssignmentData
}

// ---------------------------------------------------------------------------
// 学生端项目元信息: 老的 (projectName, nodeId int) -> 新的 (slug, moduleId string)
// LearnPage 里通过 useLearnContext 在改造后传 slug + moduleId 字符串
// 这层 shim 接 (projectName=slug, nodeId=int) 但实际 nodeId 是 ignored,
// 而是用 currentModuleId (从 LearnPage 注入)
// ---------------------------------------------------------------------------

let _currentModuleId: string | null = null

export function setCurrentModuleId(moduleId: string | null) {
  _currentModuleId = moduleId
}

function requireModule(): string {
  if (!_currentModuleId) {
    throw new Error("gateway shim: current moduleId not set; call setCurrentModuleId() first")
  }
  return _currentModuleId
}

// ---------------------------------------------------------------------------
// gateway export (与老 web/src/lib/api gateway 对齐, 但只实现学习页用到的)
// ---------------------------------------------------------------------------

export const gateway = {
  // === 取课程内容 (主路径) ===
  getCourseV2: async (projectName: string): Promise<CourseContentData> => {
    const moduleId = requireModule()
    const k = await myProjects.getKnode(projectName, moduleId)
    const data = knodeToCourseContent(k)
    const cc = (data as unknown as { course_content: { rendered_sections: Record<string, unknown> } }).course_content
    await inlineHtmlPaths(projectName, k.knode_dir || "", cc.rendered_sections)
    return data
  },
  getCourseV3: async (projectName: string): Promise<CourseContentData> => {
    const moduleId = requireModule()
    const k = await myProjects.getKnode(projectName, moduleId)
    const data = knodeToCourseContent(k)
    const cc = (data as unknown as { course_content: { rendered_sections: Record<string, unknown> } }).course_content
    await inlineHtmlPaths(projectName, k.knode_dir || "", cc.rendered_sections)
    return data
  },
  getCourseV2Assignment: async (projectName: string): Promise<CourseAssignmentData> => {
    const moduleId = requireModule()
    const k = await myProjects.getKnode(projectName, moduleId)
    return knodeToAssignment(k)
  },

  // === V3 多版本 — 学生端只看到单 version (library 上 published 的那个) ===
  listCourseV3Versions: async (
    projectName: string,
  ): Promise<CourseV3VersionsData> => {
    const moduleId = requireModule()
    const k = await myProjects.getKnode(projectName, moduleId).catch(() => null)
    const v = k?.version || "v1"
    return {
      versions: [
        { label: v, created_at: new Date().toISOString(), is_active: true } as never,
      ],
      active_version: v,
    } as unknown as CourseV3VersionsData
  },
  setCourseV3ActiveVersion: async (
    _projectName: string,
    _nodeId: number,
    versionLabel: string,
  ) => {
    // 学生端不能切版本 (只读)
    return { ok: true, active_version: versionLabel }
  },
  getCourseV3Slides: async () => {
    // 学生端没 slides API
    return { slides: [], version_label: "v1" } as never
  },
  regenerateCourseV3Slides: async () => {
    return { count: 0, version_label: "v1" }
  },

  // === 生成 / 重生成 — 学生端禁止 ===
  cancelCourseV2: async (_projectName: string, _nodeId: number) => {
    return { status: "noop" }
  },
  streamCourseV2: async (_projectName: string, _nodeId: number, _regenerate = false) => {
    // 返回一个空的 SSE Response, 让消费方读不到 chunk 即结束
    return new Response("", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })
  },
  generateCourseV2: async () => {
    return { status: "noop", project_name: "", knode_id: 0 }
  },

  // === 答题 / 评判 — 学生端 noop (spec 028/029 接) ===
  submitExerciseAttempts: async (
    _projectName: string,
    _attempts: ExerciseAttemptPayload[],
    _userId = "default",
  ): Promise<PracticeSubmissionResult> => {
    return {
      ok: true,
      submitted_count: 0,
      results: [],
    } as unknown as PracticeSubmissionResult
  },
  evaluateQa: async () => {
    return { score: 0, feedback: "(spec 028 启用 AI 评判)", ok: false } as never
  },

  // === 进度 — 桥到 myProjects.setProgress (slug + moduleId) ===
  updateNodeProgress: async (
    projectName: string,
    _nodeId: number,
    _status: string,
  ): Promise<UpdateProgressResponse> => {
    const moduleId = requireModule()
    await myProjects.setProgress(projectName, moduleId).catch(() => {})
    return { status: "passed", node_id: 0 } as unknown as UpdateProgressResponse
  },
  updateEnrollment: async (
    _projectName: string,
    _body: { add_time_seconds?: number; status?: string; user_id?: string },
  ) => {
    return { ok: true }
  },
}

export { STUDENT_API_URL }
