/** 平台知识树子域中文名 (键 = "学科id.子域id", 因子域 id 跨学科会重名)。
 *
 * 平台树节点 id 是 "学科.子域.概念" 三段; 子域只在 id 路径里, 无中文名,
 * 故前端用此映射做多层下钻分组时的子域标题。缺失时回退英文子域段。
 */

export const SUBDOMAIN_ZH: Record<string, string> = {
  // 数学
  "math.arith": "算术", "math.algebra": "代数", "math.geom": "几何",
  "math.stats": "统计", "math.prob": "概率", "math.calc": "微积分",
  "math.linalg": "线性代数", "math.discrete": "离散数学",
  // 物理
  "phys.force": "力学", "phys.kine": "运动学", "phys.energy": "能量",
  "phys.thermal": "热学", "phys.wave": "波动", "phys.opt": "光学",
  "phys.em": "电磁学", "phys.modern": "近代物理",
  // 化学
  "chem.atom": "原子结构", "chem.bond": "化学键", "chem.rxn": "化学反应",
  "chem.eq": "化学平衡", "chem.org": "有机化学", "chem.lab": "实验技术",
  "chem.env": "环境化学",
  // 生物
  "bio.basic": "生物基础", "bio.cell": "细胞", "bio.mol": "分子生物",
  "bio.gen": "遗传", "bio.evo": "进化", "bio.eco": "生态",
  "bio.neuro": "神经科学", "bio.phys": "生理",
  // 计算机科学
  "cs.prog": "编程", "cs.algo": "算法", "cs.ds": "数据结构",
  "cs.db": "数据库", "cs.net": "网络", "cs.os": "操作系统",
  "cs.web": "Web 开发", "cs.ai": "人工智能",
  // 电子电路
  "elec.circ": "电路", "elec.signal": "信号", "elec.digital": "数字电路",
  "elec.embed": "嵌入式", "elec.sensor": "传感器", "elec.comm": "通信",
  "elec.comp": "元器件",
  // 环境
  "env.air": "大气污染", "env.atm": "大气科学", "env.climate": "气候",
  "env.eco": "生态环境", "env.mon": "环境监测", "env.ocean": "海洋",
  "env.sus": "可持续",
  // 天文
  "astro.solar": "太阳系", "astro.star": "恒星", "astro.galaxy": "星系",
  "astro.cosmo": "宇宙学", "astro.tool": "观测工具",
  // 医学
  "med.anat": "解剖", "med.phys": "生理", "med.path": "病理",
  "med.diag": "诊断", "med.epi": "流行病学", "med.lifestyle": "健康生活",
  // 工程
  "eng.mech": "机械", "eng.ctrl": "控制", "eng.robo": "机器人",
  "eng.design": "设计", "eng.mat": "材料", "eng.mfg": "制造",
  // 地质
  "geo.earth": "地球结构", "geo.plate": "板块", "geo.rock": "岩石",
  "geo.erosion": "风化侵蚀", "geo.paleo": "古生物", "geo.res": "矿产资源",
}

/** 取子域中文名; 缺失回退英文段。 */
export function subdomainName(subjectId: string, subId: string): string {
  return SUBDOMAIN_ZH[`${subjectId}.${subId}`] || subId
}
