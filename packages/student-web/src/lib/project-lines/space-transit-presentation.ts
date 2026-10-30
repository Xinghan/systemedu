/** Presentation only. Course IDs, original stages and record scopes stay in the curriculum. */
export const TRANSIT_CAMPUS_IMAGE = "/mission/space/transit/campus-v1.webp"
export const TRANSIT_HERO_IMAGE = "/mission/space/transit/briefing-v1-1920.webp"
export const TRANSIT_MAP_POINTS = [
  { x: 260, y: 260, path: "M260 260 Q510 300 760 260" },
  { x: 760, y: 260, path: "M760 260 Q1010 300 1260 260" },
  { x: 1260, y: 260, path: "M1260 260 Q1430 485 1260 720" },
  { x: 1260, y: 720, path: "M1260 720 Q1010 760 760 720" },
  { x: 760, y: 720, path: "M760 720 Q510 760 260 720" },
  { x: 260, y: 720 },
]
export const TRANSIT_ACTS = [
  { id: "transit-p1", role: "接受调查", task: "先观察，再提出猜想", support: "从一张图和一个问题开始，先说出还不能确定什么。无需购买望远镜。", briefing: "我是林岚。这次我们一起看恒星的亮度记录。先别急着把一次变暗叫作行星：请在原图上标出你看到的位置，再写下一个猜想和两个可能的替代解释。带着问题和数据来源，我们再进入实验室。" },
  { id: "transit-p2", role: "准备证据", task: "让每次处理都可追溯", support: "陪他记录原文件、质量规则和参数；让他解释为什么保留或删去一个点。", briefing: "把上一站的原图和问题带来。我们先核对数据来源，再检查质量标记、缺失值和趋势。每改一个处理规则，都留下输入、参数和输出。交接时，我希望另一位同伴能重跑出同样的表，而不是只看到一张好看的图。" },
  { id: "transit-p3", role: "搜索周期", task: "解释重复下降的依据", support: "先用小样例理解相位折叠，再读周期图；让孩子自己比较候选峰。", briefing: "现在我们有了一份能复跑的数据。先用小样例理解：同一个周期，怎样把不同时间的观测排到一起？再用盒形信号搜索比较候选周期。最高的峰只是调查线索，请把搜索范围和其他候选峰也留在证据册里。" },
  { id: "transit-p4", role: "检查反例", task: "主动寻找误判的原因", support: "鼓励写下反对证据。否定一个猜想同样是有效成果，不替孩子保住原结论。", briefing: "这一站，我邀请你主动反对自己的猜想。比较奇偶次下降、不同处理规则和邻近信号，找找哪里可能产生误判。把支持、反对和未知分别对应到数据上；如果证据推翻了候选周期，就如实写下来。" },
  { id: "transit-p5", role: "独立验证", task: "先封存，再打开新观测", support: "确认预测先保存，再打开独立片段；保留首次结果，后续改动标为探索。", briefing: "请先根据已有数据确定周期、历元和容差，在 M24 保存预测。到 M25，我们才打开另一段观测。结果不理想也别覆盖它：保留首次结果，再把后来的修改单独记为探索。这样，新数据才真的有机会检验猜想。" },
  { id: "transit-p6", role: "复现交付", task: "让同伴从原数据重跑", support: "请一位同伴按说明复跑。用实际失败定位缺失步骤，留下修订和结论边界。", briefing: "最后，请把原始数据索引、可运行程序、参数、证据图和结论边界放进同一份研究档案。让同伴从原数据开始复跑，再请他指出哪里无法重复。我们交付的是可复查的已知信号调查，不把保存成功当作发现新行星。" },
] as const

// Existing unoccupied research scenes, chosen by the task performed in each room.
export const TRANSIT_ROOM_SCENES: Record<string, string> = {
  "transit-p1": "/mission/space/stations/first-contact-v1",
  "transit-p2": "/mission/space/stations/perception-v1",
  "transit-p3": "/mission/space/stations/mission-design-v1",
  "transit-p4": "/mission/space/stations/perception-v1",
  "transit-p5": "/mission/space/stations/first-contact-v1",
  "transit-p6": "/mission/space/stations/delivery-v1",
}
