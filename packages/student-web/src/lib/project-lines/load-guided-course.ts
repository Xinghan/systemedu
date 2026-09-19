import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { GuidedCourse, GuidedModule, LearningResource } from "./guided-course"

// 读取受版本控制的本地课程包；不把本地格式当作内容服务已发布课程。
export async function loadDrivingCourse(): Promise<GuidedCourse> {
  const root = path.join(process.cwd(), "public/project-lines/space-exploration/write-driving-rules/course")
  type SourceModule = Omit<GuidedModule, "resources"> & { resources: string }
  const tree = JSON.parse(await readFile(path.join(root, "tree/knowledge_tree.json"), "utf8")) as Omit<GuidedCourse, "modules"> & { modules: SourceModule[] }
  const read = (relative: string) => {
    const file = path.resolve(root, relative)
    if (!file.startsWith(root + path.sep)) throw new Error("课程文件路径无效")
    return readFile(file, "utf8")
  }
  const modules = await Promise.all(tree.modules.map(async module => {
    const [lesson, assignment, resources] = await Promise.all([read(module.lesson), read(module.assignment), read(module.resources)])
    return { ...module, lesson, assignment, resources: JSON.parse(resources) as LearningResource[] }
  }))
  return { ...tree, modules }
}
