import type { Locale } from "@/lib/i18n/locales"

type Copy = { zh: string; en: string }
const text = (zh: string, en: string): Copy => ({ zh, en })
export const FUTURES_HREF = "/library?view=futures"
export const futureHref = (id: string) => `${FUTURES_HREF}&role=${encodeURIComponent(id)}`
export const FUTURE_VIEW_COPY = {
  zh: { title: "未来的我", hint: "先看想成为怎样的人，再找到今天的第一步", count: "个职业探索方向" },
  en: { title: "Future me", hint: "Explore who you could become. Find your first step today.", count: "career directions to explore" },
}

export type FuturePath = {
  id: string; lineId: string; icon: "robot" | "space" | "molecule" | "energy" | "earth"
  title: Copy; shortTitle: Copy; invitation: Copy; ambition: Copy; description: Copy
  flagship: string; imageFallback: string; imageAlt: Copy
  abilities: Copy[]; family: Copy; preparation: Copy
  steps: { projectId: string; title: Copy; ability: Copy }[]
}

// These are editable exploration suggestions, not qualifications or compulsory prerequisites.
// Availability and links come from the existing project catalog at render time.
export const FUTURE_PATHS: FuturePath[] = [
  {
    id: "robotics", lineId: "neuro-bionics", icon: "robot",
    title: text("机器人与具身智能工程师", "Robotics & embodied AI engineer"),
    shortTitle: text("机器人工程师", "Robotics engineer"),
    invitation: text("让机器学会和人一起工作", "Teach machines to work with people"),
    ambition: text("我想造一个，能跟我学本领的机器人。", "I want to build a robot that learns from me."),
    description: text("从控制一次抓取，到打印自己的机构，再尝试用示范教双臂协作。让一个想法真正动起来。", "Start with a grasp, print a mechanism, then explore teaching two arms through demonstrations. Make an idea move."),
    flagship: "aloha-bimanual-apprentice", imageFallback: "/project-lines/neuro-bionics/aloha/cover-editorial-v2.png",
    imageAlt: text("ALOHA 启发的桌面双臂机器人项目示意", "A desktop dual-arm robotics project inspired by ALOHA"),
    abilities: [text("把目标拆成可执行的动作", "Turn a goal into executable actions"), text("连接信号、程序和机构", "Connect signals, code and mechanisms"), text("用测试找出失败原因，再改进", "Use tests to explain and improve failures")],
    family: text("看孩子能否从“让夹爪碰到目标”，进步到解释失败原因、修改设计，并在陌生物体上检验。", "Look for the move from reaching an object to explaining failures, revising a design and testing unfamiliar objects."),
    preparation: text("先在浏览器尝试。实物阶段使用 3D 打印结构与可购买的电机、传感器等简单标准件，需要成人协助。", "Start in a browser. Physical stages use 3D-printed structures and accessible motors, sensors and standard parts, with adult support."),
    steps: [
      { projectId: "grasp-a-virtual-block", title: text("让夹爪碰到目标", "Reach an object with a gripper"), ability: text("观察：一次改动，会带来什么变化？", "Observe what changes when you adjust one thing.") },
      { projectId: "write-a-grasp-rule", title: text("给夹爪写行动规则", "Program a gripper rule"), ability: text("控制：把观察变成机器能执行的规则。", "Turn observations into rules a machine can execute.") },
      { projectId: "assemble-a-signal-controller", title: text("造一台信号抓取机", "Build a signal-controlled gripper"), ability: text("集成：让信号、代码和打印机构一起工作。", "Make signals, code and a printed mechanism work together.") },
      { projectId: "test-an-unseen-object", title: text("接下陌生物体挑战", "Meet an unfamiliar object"), ability: text("迁移：遇到新目标，自己定方案并验证。", "Plan and test an approach for an unfamiliar target.") },
      { projectId: "aloha-bimanual-apprentice", title: text("教会双臂一起干活", "Teach two arms to work together"), ability: text("完整工程：采集示范、训练策略、检验双臂协作。", "Collect demonstrations, train a policy and test coordination.") },
    ],
  },
  {
    id: "space", lineId: "space-exploration", icon: "space",
    title: text("太空探索工程师", "Space exploration engineer"), shortTitle: text("太空探索工程师", "Space engineer"),
    invitation: text("把探测车送向未知的地形", "Send a rover into unfamiliar terrain"),
    ambition: text("我想造一辆，能替我探索远方的车。", "I want to build a rover that explores beyond my reach."),
    description: text("先亲自驾驶、观察地形，再编写规则、组装探测车，逐步承担一次完整的探索任务。", "Drive and observe first. Write rules, build a rover and gradually take responsibility for an exploration mission."),
    flagship: "mars-analog-rover", imageFallback: "/project-covers/mars-analog-rover/cover-editorial-v3.webp",
    imageAlt: text("火星类比探测车与地形测试场景示意", "A Mars-analog rover and terrain test scene"),
    abilities: [text("根据观察选择路线与目标", "Choose routes and goals from observations"), text("设计并测试探测车的结构与规则", "Design and test rover structures and rules"), text("用任务记录证明方案是否有效", "Use mission records to evaluate a design")],
    family: text("看孩子能否从亲自操控，进步到给出可执行的方案，并用路线、照片和实测记录说明结果。", "Look for the move from manual driving to a testable plan, supported by routes, photos and measurements."),
    preparation: text("从浏览器驾驶开始。后续实物项目需要 3D 打印、电机与低压电子模块；可以先完成数字原型。", "Start by driving in a browser. Later physical projects need 3D printing, motors and low-voltage modules; digital prototypes can come first."),
    steps: [
      { projectId: "drive-and-frame", title: text("开车找到观察点", "Drive to an observation point"), ability: text("观察：选择目标，绕开岩石，留下证据。", "Choose a goal, navigate rocks and record evidence.") },
      { projectId: "write-driving-rules", title: text("写出我的第一段驾驶规则", "Write my first driving rules"), ability: text("建模：把自己的驾驶判断写成条件规则。", "Express your driving decisions as conditional rules.") },
      { projectId: "assemble-a-rover", title: text("造一辆真正会行动的探测车", "Build a working rover"), ability: text("制造：把数字方案变成可测试的实物。", "Turn a digital design into a testable physical rover.") },
      { projectId: "run-an-expedition", title: text("带着探测车，完成一次真远征", "Run a rover expedition"), ability: text("验证：面对实际场地，自己计划并修订。", "Plan and revise a mission in a real setting.") },
      { projectId: "mars-analog-rover", title: text("火星类比探测车", "Mars-analog rover"), ability: text("完整工程：连接感知、控制和探索任务。", "Connect perception, control and an exploration mission.") },
    ],
  },
  {
    id: "molecular-discovery", lineId: "biomedicine", icon: "molecule",
    title: text("AI 药物发现研究员", "AI drug-discovery researcher"), shortTitle: text("AI 药物研究员", "AI drug researcher"),
    invitation: text("从分子数据中寻找新的可能", "Find new possibilities in molecular data"),
    ambition: text("我想用 AI，在分子的世界里找到新线索。", "I want to use AI to find clues in the world of molecules."),
    description: text("从认出一个分子开始，建立筛选方法、检查预测，再为候选分子写出有证据的研究报告。", "Recognize a molecule, build a filter, evaluate predictions and write an evidence-based candidate report."),
    flagship: "molecule-monster-hunter", imageFallback: "/project-covers/molecule-monster-hunter/cover-editorial-v3.webp",
    imageAlt: text("分子候选筛选与研究工作台项目示意", "A molecular candidate screening and research workbench"),
    abilities: [text("把分子结构转化成可比较的数据", "Turn molecular structures into comparable data"), text("比较筛选方法和预测误差", "Compare screening methods and prediction errors"), text("说明研究结论的证据与局限", "Explain the evidence and limits of a conclusion")],
    family: text("看孩子能否从选出一个候选，进步到解释为什么保留它、预测哪里可能出错，以及还缺什么证据。", "Look for explanations of why a candidate was retained, where a prediction may fail and what evidence is still missing."),
    preparation: text("以计算与数据研究为主，无需购买化学品。候选筛选练习不等于药效证明；完整课程按要求准备 Python 环境。", "Primarily computational work, with no chemicals to purchase. Screening is not proof of drug efficacy; full courses specify the Python setup."),
    steps: [
      { projectId: "turn-a-molecule", title: text("转动我的第一个分子", "Turn my first molecule"), ability: text("观察：认识结构，留下自己的原子标记。", "Notice structure and make your own atom annotations.") },
      { projectId: "build-a-candidate-filter", title: text("做一台分子筛选器", "Build a candidate filter"), ability: text("方法：制定条件，比较两套筛选结果。", "Define criteria and compare two sets of results.") },
      { projectId: "assemble-a-discovery-desk", title: text("搭起我的分子发现工作台", "Assemble a discovery workbench"), ability: text("系统：让筛选、预测与复核组成工作流程。", "Connect screening, prediction and review into a workflow.") },
      { projectId: "challenge-an-unseen-library", title: text("打开未知分子档案", "Open an unseen molecule library"), ability: text("研究：先定方案，再用未知数据检验。", "Commit to a plan, then evaluate unseen data.") },
      { projectId: "molecule-monster-hunter", title: text("分子怪兽猎人", "Molecule Monster Hunter"), ability: text("完整研究：交付候选筛选工作台与研究报告。", "Deliver a screening workbench and candidate research report.") },
    ],
  },
  {
    id: "clean-energy", lineId: "energy-motion", icon: "energy",
    title: text("新能源系统工程师", "Clean-energy systems engineer"), shortTitle: text("新能源工程师", "Energy engineer"),
    invitation: text("让阳光和风，成为可靠的电力", "Turn sunlight and wind into dependable power"),
    ambition: text("我想让自己的小能源站，知道什么时候发电、什么时候储能。", "I want my energy station to know when to generate and when to store."),
    description: text("从调整太阳能板的角度，走向风、光、储能与调度控制，再用真实测量检验发电预报。", "Begin with panel angle, connect wind, solar, storage and control, then test forecasts against real measurements."),
    flagship: "pvlib-solar-forecast-station", imageFallback: "/project-lines/energy-motion/cover-cinematic-v3.png",
    imageAlt: text("太阳能发电测量与预报项目示意", "A solar measurement and forecasting project"),
    abilities: [text("设计公平的能量对照试验", "Design comparable energy experiments"), text("权衡发电、储能与任务需求", "Balance generation, storage and demand"), text("用测量检查模型与预测", "Check models and predictions with measurements")],
    family: text("看孩子能否从“让灯亮起来”，进步到核对能量账本、说明取舍，并解释预测和实测为何不同。", "Look for progress from lighting a beacon to accounting for energy, explaining trade-offs and investigating forecast errors."),
    preparation: text("入门可直接操作。实物阶段使用通用低压器材与 3D 打印结构；太阳能板和测量模块按课程准备。", "Begin with an interactive experience. Physical work uses generic low-voltage equipment and printed structures; follow each course's parts list."),
    steps: [
      { projectId: "catch-a-sunbeam", title: text("接住一束阳光", "Catch a sunbeam"), ability: text("发现：改变角度，对比能量变化。", "Adjust an angle and compare energy output.") },
      { projectId: "write-energy-dispatch-rules", title: text("写一个能源调度员", "Write energy dispatch rules"), ability: text("控制：根据供需，决定能量如何分配。", "Allocate energy based on supply and demand.") },
      { projectId: "build-a-wind-solar-station", title: text("建造风光储能源站", "Build a wind-solar station"), ability: text("集成：把发电、储能和控制接成系统。", "Integrate generation, storage and control.") },
      { projectId: "run-an-energy-mission", title: text("让能源站完成一次任务", "Run an energy mission"), ability: text("验证：让系统接受具体任务的检验。", "Evaluate the system against a defined mission.") },
      { projectId: "pvlib-solar-forecast-station", title: text("给阳光做一份发电预报", "Make a solar power forecast"), ability: text("完整研究：用真实光伏测量检验预测。", "Evaluate forecasts against real photovoltaic measurements.") },
    ],
  },
  {
    id: "earth-research", lineId: "earth-discovery", icon: "earth",
    title: text("地球与环境研究员", "Earth & environmental researcher"), shortTitle: text("地球与环境研究员", "Environmental researcher"),
    invitation: text("用数据读懂正在变化的地球", "Use evidence to understand a changing planet"),
    ambition: text("我想知道，身边的环境正在发生什么。", "I want to understand what is changing around me."),
    description: text("从辨认影像中的变化开始，记录、整理和核查观察，再用自己的传感节点留下真实环境数据。", "Notice changes in images, organize and check observations, then collect environmental data with your own sensor node."),
    flagship: "purpleair-airquality-node", imageFallback: "/project-covers/purpleair-airquality-node/cover-editorial-v3.webp",
    imageAlt: text("空气质量传感器与环境数据仪表盘项目示意", "An air-quality sensor and environmental data dashboard"),
    abilities: [text("分清看到的现象与自己的推测", "Distinguish observations from interpretations"), text("整理有缺测、有噪声的真实数据", "Handle missing and noisy measurements"), text("建立可追溯、可复查的调查记录", "Keep traceable, reviewable investigation records")],
    family: text("看孩子能否从发现一个变化，进步到留下可复查的证据，说明数据缺口，并提出下一次采样计划。", "Look for progress from noticing a change to recording evidence, explaining gaps and planning the next observations."),
    preparation: text("先读图与分析数据。传感节点阶段需要低压传感器、3D 打印外壳和成人协助；采样按项目说明开展。", "Start with images and data. Sensor projects need low-voltage sensors, a printed enclosure and adult support for sampling."),
    steps: [
      { projectId: "spot-a-landscape-change", title: text("找出地表的变化", "Spot a landscape change"), ability: text("观察：从影像中找出能说明的变化。", "Identify a change you can explain from imagery.") },
      { projectId: "read-an-air-day", title: text("读懂空气的一天", "Read a day in the air"), ability: text("分析：处理缺测，比较方法，说明边界。", "Handle gaps, compare methods and explain limits.") },
      { projectId: "assemble-a-field-notebook", title: text("组装我的地球调查档案", "Build a field evidence notebook"), ability: text("整合：让数据、地图与结论能够互相核查。", "Connect data, maps and conclusions for review.") },
      { projectId: "purpleair-airquality-node", title: text("空气质量观测节点", "Air-quality observation node"), ability: text("完整工程：搭建传感节点，采集并分析实测数据。", "Build a sensor node, collect measurements and analyze them.") },
    ],
  },
]

export function futureCopy(copy: Copy, locale: Locale) { return copy[locale] }
