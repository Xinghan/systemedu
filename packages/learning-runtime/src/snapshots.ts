import type { HandState } from "./experiments/mechanical-hand/scene"
import { PARTS, type Part } from "./experiments/mars-landing/content"

const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}
const bounded = (v: unknown, low: number, high: number, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(high, Math.max(low, v)) : fallback
const bool = (v: unknown, fallback: boolean) => typeof v === "boolean" ? v : fallback
export function handSnapshot(input: unknown): HandState {
  const s = object(input), c = object(s.commands)
  return { commands: { thumb: bounded(c.thumb, 0, 1, .12), index: bounded(c.index, 0, 1, .2), middle: bounded(c.middle, 0, 1, .12), ring: bounded(c.ring, 0, 1, .08), little: bounded(c.little, 0, 1, .05) }, opposition: bounded(s.opposition, 0, 1, .15), ball: bool(s.ball, false), shells: bool(s.shells, true), tendons: bool(s.tendons, false), selected: ["thumb","index","middle","ring","little"].includes(String(s.selected)) ? s.selected as HandState["selected"] : "index" }
}
export function landingSnapshot(input: unknown) {
  const s = object(input)
  return { time: bounded(s.time, 0, 42, 25), speed: [.5,1,2].includes(Number(s.speed)) ? Number(s.speed) : 1, hidden: bool(s.hidden, false), selected: typeof s.selected === "string" && Object.hasOwn(PARTS, s.selected) ? s.selected as Part : null, answer: bool(s.answer, false) }
}
