export const DURATION = 42
export const ASSET = "/mars-landing/mars-landing.glb"
export const STAGES = [
  { id: "parachute", title: "降落伞减速", start: 0, end: 4, seek: 0, verb: "借助大气，先把速度降下来", body: "降落伞连接着背罩，火星车和下降级仍在保护壳内。火星大气很稀薄，降落伞虽然能显著减速，却不能独自把这台重型火星车安全送到地面。", fact: "毅力号降落伞直径约 21.5 米", question: "降落伞拉着谁？", answer: "伞绳连接的是背罩。此时，背罩与隔热罩保护着内部的火星车和下降级。试着隐藏外壳，查看其中的结构。", part: "parachute" },
  { id: "heatshield", title: "抛掉隔热罩", start: 4, end: 10, seek: 6, verb: "打开下方视野，让地面进入传感器", body: "进入大气时，朝前的隔热罩抵挡高温。减速后，它从下方脱离。这样，着陆雷达和地形成像系统才能观察地面，帮助确定高度、运动状态和着陆位置。", fact: "先抛隔热罩，后脱离背罩与降落伞", question: "为什么不把隔热罩一直带着？", answer: "它完成了进入大气时的热防护任务。抛掉后既能露出向下观察的传感器，也能为后续下降和轮子接地腾出空间。", part: "heatshield" },
  { id: "powered", title: "动力下降", start: 10, end: 18, seek: 14, verb: "脱离背罩，由火箭控制最后的下降", body: "火星车与下降级一起脱离背罩和降落伞。下降级上的火箭发动机开始工作，控制下降速度和运动方向，并带着火星车接近选定的着陆点。", fact: "实际分离高度约为 2.1 千米", question: "喷口为什么分布在火星车两侧？", answer: "下降级承担动力控制，喷口位于外围，使主要喷流避开下方的车体。图中用橙色标出喷流方向；它的外形和亮度是示意。", part: "descent" },
  { id: "skycrane", title: "缆绳放下火星车", start: 18, end: 32, seek: 25, verb: "动力留在上方，六个轮子接近地面", body: "接近地面时，下降级用三根承重缆绳放下火星车，另有连接线传递电力与通信。悬架和车轮展开到着陆位置。火星车不需要连同火箭平台一起落在地面上。", fact: "实际约在 20 米高开始，缆绳长约 6.4 米", question: "为什么把火星车吊在下面？", answer: "这样可以让六个轮子直接接地，把火箭发动机和下降平台留在上方。观察缆绳两端：一端是下降级，另一端连接车体，而不是车轮。", part: "bridle" },
  { id: "touchdown", title: "触地后飞离", start: 32, end: 42, seek: 36, verb: "先确认轮子接地，再切断连接", body: "当火星车确认车轮已经接触地面，连接缆绳被切断。下降级随后飞离，在远处坠落。火星车留在着陆点，之后才逐步展开桅杆并开始地面任务。", fact: "先触地 → 切断连接 → 下降级飞离", question: "能不能先切断缆绳，再等它落地？", answer: "不可以。切断前，需要确认火星车已由地面支撑；提前切断会让它自由下落。拖动时间轴到接地前后，比较两种状态。", part: "rover" },
] as const
export type Part = "rover" | "descent" | "parachute" | "backshell" | "heatshield" | "bridle"
export const PARTS: Record<Part, { name: string; english: string; detail: string }> = {
  rover: { name: "火星车", english: "ROVER", detail: "六轮车体、摇臂悬架、收起的桅杆与机械臂。这里保留与着陆有关的结构，科学仪器的外形有所简化。" },
  descent: { name: "动力下降级", english: "DESCENT STAGE", detail: "承载推进系统和下降控制装置。模型展示八个外围喷口；触地后，这一部分独自飞离。" },
  parachute: { name: "降落伞", english: "PARACHUTE", detail: "上部伞顶、环形间隙和下部伞带构成简化的盘缝带式结构。伞绳连接背罩；伞的相对尺寸经过缩小，便于同时观察整套装置。" },
  backshell: { name: "背罩", english: "BACKSHELL", detail: "与隔热罩组成进入大气时的保护外壳。它连接降落伞；动力下降开始后，背罩与伞一同被留在后方。" },
  heatshield: { name: "隔热罩", english: "HEAT SHIELD", detail: "位于进入大气方向的前端，承担热防护。抛掉后，向下观察的传感器能够看到地面。" },
  bridle: { name: "承重缆绳与连接线", english: "BRIDLE + UMBILICAL", detail: "三根较细的承重缆绳与一根较粗的连接线。承重缆绳从下降级连接到车体；触地后切断连接。" },
}
export function stageAt(time: number) {
  return Math.max(0, STAGES.findLastIndex(stage => time >= stage.start))
}
