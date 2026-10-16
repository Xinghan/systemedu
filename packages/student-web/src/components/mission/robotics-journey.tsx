"use client"
import { ROBOTICS_MISSION } from "@/lib/project-lines/robotics-mission"
import { roboticsControlConfig } from "./robotics-mission-control"
import { IntegratedJourney } from "./integrated-journey"
const copy={eyebrow:"BIMANUAL ROBOTICS / 工程任务",headline:"先教会一只夹爪，再教会双臂自己协作。",intro:"从一次抓取发现开始，亲手打印、装配并示范，最终用自己的数据训练双臂完成托盘与插块任务。",opening:"原 ALOHA 的 82 个节点与 24 个信号、规则、打印和系统课程节点共同组成 19 段任务。小夹爪提供可暂停的实物里程碑，正式双臂保留全部机制学习和独立验收。",preparation:"开始只需浏览器。后续提前准备 3D 打印或代打印、标准电机、低压控制板与相机；四臂工位和训练设备可共享，实际操作由成人协助。单夹爪和合成数据不能替代本人双臂与真实示范。",outcome:"可复现的自主双臂任务",handover:"打印工位 → 同步遥操作 → 本人示范 → 策略训练 → 自主验证与复现。"}
export function RoboticsJourney(){return <IntegratedJourney mission={ROBOTICS_MISSION} config={roboticsControlConfig} copy={copy}/>}
