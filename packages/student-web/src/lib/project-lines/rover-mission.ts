import type { GuidedCourse } from "./guided-course"
import type { NodeRecord } from "./guided-progress"
import type { LearningBody, LearningScope } from "../api/learning-records"
import { isPhysicalRover, isRoverSystem, physicalChecks, prototypeChecks } from "./rover-system"

export const ROVER_WORK_SCOPE: LearningScope = { library_slug: "assemble-a-rover", module_id: "WORK", activity_id: "system-build", kind: "classroom", content_version: "2.0" }
export const ROVER_DELIVERY_SCOPE: LearningScope = { library_slug: "assemble-a-rover", module_id: "M08", activity_id: "final-deliverable", kind: "assignment", content_version: "2.0" }
export const ROVER_COURSE_PATH = "/explore/space-exploration/assemble-a-rover"
export const hasRoverMission = (course: GuidedCourse) => course.id === "assemble-a-rover" && course.version === "2.0" && !course.legacy_edition
export const missionNodeHref = (id: string, anchor = "") => `${ROVER_COURSE_PATH}?node=${id}${anchor}`

export const ROVER_BRIEFS: Record<string, { place: string; message: string; action: string }> = {
  M01: { place: "任务控制室", message: "这次，我们要把探测车从屏幕带到桌面。先把“做成了”的条件写清楚，再准备工具和分工。", action: "列出可以测量的目标，确认打印、器材和成人协助安排。" },
  M02: { place: "系统接入台", message: "各个部件都在，但信息还没有接通。让观察变成判断，再让判断变成动作。", action: "选择接口来源，运行一次，查看信息在哪一层中断。" },
  M03: { place: "设计工作台", message: "更大的轮子和电池，都有代价。我们需要一份说得清取舍、也经得起测试的方案。", action: "保留第一版设计，改变参数，用同一条路线比较结果。" },
  M04: { place: "故障诊断席", message: "探测车没有完成任务。先别急着换零件，找到能区分不同原因的证据。", action: "做两项检查，再验证修复前后的结果。" },
  M05: { place: "新路线试验场", message: "熟悉路线上的成功还不够。把同一版设计交给新的路线，看它能否适应。", action: "测试新路线，必要时修改，然后重新检查当前方案。" },
  M06: { place: "3D 打印制造间", message: "现在，尺寸要落到真实材料上。先打印小试配件，把误差留在小样里。", action: "测量接口、修改 CAD，留下打印试配前后的记录。" },
  M07: { place: "装配与调试台", message: "让程序通过真实的线路控制车辆。先架空调试，再确认触碰后的停止行为。", action: "记录实际接线与程序改动，和成人一起完成通电检查。" },
  M08: { place: "作品交付现场", message: "用你的车、照片和测量来讲述结果。哪些达到了目标，哪些还需要改进？", action: "整理三类实测、两张照片、制造与程序修改，提交作品等待评阅。" },
}

export type MissionNodeStatus = "loading" | "unknown" | "submitted" | "draft" | "new"
export function missionNodeStatus(record: NodeRecord | undefined, loaded: boolean, failed: boolean): MissionNodeStatus {
  if (record?.submitted_at) return "submitted"
  if (record?.answers.some(answer => answer.trim())) return "draft"
  if (!loaded) return "loading"
  return failed ? "unknown" : "new"
}
export const MISSION_STATUS_LABEL: Record<MissionNodeStatus, string> = { loading: "读取中", unknown: "进度待读取", submitted: "记录已提交", draft: "有草稿", new: "待开始" }

export function roverEvidenceSummary(work: LearningBody | null, delivery: LearningBody | null, submittedAt?: string) {
  const rover = isRoverSystem(work?.artifact) ? work!.artifact : null
  const digital = rover ? prototypeChecks(rover) : []
  const physical = rover ? physicalChecks(rover.physical, rover.design) : []
  return {
    digital: digital.filter(c => c.passed).length, digitalTotal: 5,
    physical: physical.filter(c => c.passed).length, physicalTotal: 6,
    submitted: !!submittedAt && isPhysicalRover(delivery?.artifact) && delivery?.answers.length === 3 && delivery.answers.every(a => a.answer.trim()),
    invalid: (!!work?.artifact && !rover) || (!!submittedAt && !isPhysicalRover(delivery?.artifact)),
  }
}
