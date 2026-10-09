// Arrival videos are presentation preferences, not completion or assessment records.
export type SpaceStage = 1 | 2 | 3 | 4 | 5
export const SPACE_STAGE_FILMS = {
  1: { title: "第一份观测档案", description: "从观测台开始：移动镜头，拍下一个世界，带回照片和一个发现。之后可以继续体验着陆与取景。" },
  2: { title: "让每个决定都有证据", description: "从选址开始比较方案，再调整底盘、标注地形、写行动规则。带回经过测试的方法，以及失败与修改的记录。" },
  3: { title: "让系统走出屏幕", description: "先画清相机、判断与驱动的连接，验证数字原型；再 3D 打印结构件，装配简单低压器件。最终交付实物车、程序、照片与实测记录。" },
  4: { title: "带着问题走进现场", description: "先写目标、路线和停止条件。在安全的新场地测试实物车，保留预期、失败、修改与复测结果，交付远征档案。" },
  5: { title: "选择你的探索方向", description: "可以选择自主探测车工程，也可以研究真实恒星观测数据。从任务标准或研究问题开始，交付别人能够复核的作品与证据。" },
} satisfies Record<SpaceStage, { title: string; description: string }>

export function spaceStageFilm(level: SpaceStage) {
  return { ...SPACE_STAGE_FILMS[level], level,
    src: `/mission/space/video/stage-${level}-v1.mp4`,
    captions: `/mission/space/video/stage-${level}-zh.vtt`,
  }
}

export const stageFilmSeenKey = (level: SpaceStage) => `systemedu:mission:space:stage-film:${level}:v1`
const seenInSession = new Set<SpaceStage>()
export function hasSeenStageFilm(level: SpaceStage) {
  try { return seenInSession.has(level) || localStorage.getItem(stageFilmSeenKey(level)) === "1" }
  catch { return seenInSession.has(level) }
}
export function rememberStageFilm(level: SpaceStage) {
  seenInSession.add(level)
  try { localStorage.setItem(stageFilmSeenKey(level), "1") }
  catch { /* A denied browser preference must never prevent starting a course. */ }
}
