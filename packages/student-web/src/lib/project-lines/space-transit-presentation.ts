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
  {
    "id": "transit-p1",
    "role": "开始调查",
    "task": "先观察，再提出猜想",
    "support": "从光变曲线出发，说明看到的现象和仍不确定的问题。无需购买望远镜。",
    "briefing": "我是林岚。这次我们一起分析 Kepler-10 的亮度记录。先在原图中标出值得调查的位置，核对数据来源，再提出一个猜想和两种其他解释。一次变暗可能有多种原因，我们将用后面的检查逐步判断。"
  },
  {
    "id": "transit-p2",
    "role": "整理数据",
    "task": "说明每一步处理的理由",
    "support": "记录文件、筛选规则和参数，说明为什么保留或排除某条记录。",
    "briefing": "这一阶段从 Q3 原文件开始，学习读取数据、解释质量标记、检查缺失值和计算相对亮度。每一步都保存输入、参数、输出和排除原因，使同伴能够从原文件重新生成相同的分析表。"
  },
  {
    "id": "transit-p3",
    "role": "搜索周期",
    "task": "理解重复下降的计算方法",
    "support": "先用小例子理解相位折叠，再比较真实数据中的候选周期。",
    "briefing": "接下来估计缓慢变化的趋势，并比较重复下降的时间。我们先手算相位和盒形模型评分，再搜索 Q3 的候选周期。最高峰只是线索；搜索范围、其他候选峰和未解决的问题也需要记录。"
  },
  {
    "id": "transit-p4",
    "role": "检查其他解释",
    "task": "寻找可能导致误判的原因",
    "support": "鼓励记录反对证据，候选被排除也可以是有效的分析结果。",
    "briefing": "比较半周期与双周期、奇偶事件的深度、质量异常和附近光源。每项检查都要说明支持什么、反对什么、还有什么无法判断。若证据不支持原先的候选，就保存检查过程并据此修改判断。"
  },
  {
    "id": "transit-p5",
    "role": "检验新观测",
    "task": "先保存方法和预测，再查看 Q4",
    "support": "确认预测先保存，保留首次结果，另行记录后续修改。",
    "briefing": "先用 Q3 确定周期、参考时刻、处理参数和判断条件。在 M23 记录方法，在 M24 核对预测表，到 M25 再查看 Q4 亮度。无论结果是否支持预测，都保留首次输出；看到结果后的修改另行保存并说明原因。"
  },
  {
    "id": "transit-p6",
    "role": "完成项目",
    "task": "让同伴重新运行并核对结果",
    "support": "请同伴按说明运行程序，记录遇到的问题、修订和仍未解决的限制。",
    "briefing": "整理数据来源、程序、参数、环境和分析结果，让同伴能按说明从头运行。再改变一个参数，解释结果为什么变化，最后恢复首次方法并核对输出。报告应说明已知凌星信号的证据，以及观测和方法仍有哪些限制。"
  }
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
