"use client"
import { ENERGY_MISSION } from "@/lib/project-lines/energy-mission"
import { energyControlConfig } from "./energy-mission-control"
import { IntegratedJourney } from "./integrated-journey"
const copy={eyebrow:"RENEWABLE ENERGY / 工程任务",headline:"为一座观测站，把明天的能量准备好。",intro:"从第一束光到本人打印的风光储装置，把测量、预报和真实验证接成一次连续的供电任务。",opening:"小课与 pvlib 按同一个问题交错推进：先定义任务、校准测量与打印部件，再接通能源站、建立模型、封存预报。每一段都明确自己的输入和交付。",preparation:"浏览器即可出发，数字原型可先完成。实物阶段需要低压器材、3D 打印或代打印与成人协助；正式预报需要原课的 Python 环境与真实采集。热机和传动保留为独立支线。",outcome:"可复跑的能源工程档案",handover:"打印装配 → 校准测量 → 事前预报 → 首次验证 → 独立复跑。"}
export function EnergyJourney(){return <IntegratedJourney mission={ENERGY_MISSION} config={energyControlConfig} copy={copy}/>}
