import rig from "./rig.json"

export { rig }
export type FingerId = "thumb" | "index" | "middle" | "ring" | "little"
export type Vec3 = [number, number, number]
export type Commands = Record<FingerId, number>
export type FingerConfig = typeof rig.fingers[number]
export type Pose = { command: number; amount: number; angles: number[]; points: Vec3[]; pull: number; drumAngle: number; contact: boolean }
export const OPEN: Commands = { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 }
const rad = Math.PI / 180
export const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(x) ? x : low))

export function fingerPoints(finger: FingerConfig, amount: number, opposition: number): Vec3[] {
  const spread = (finger.spread - (finger.id === "thumb" ? 85 * clamp(opposition) : 0)) * rad
  const points: Vec3[] = [[...finger.base] as Vec3]
  let angle = 0
  finger.lengths.forEach((length, i) => {
    angle += finger.limits[i] * clamp(amount) * rad
    const previous = points.at(-1)!
    points.push([previous[0] - Math.sin(spread) * Math.cos(angle) * length, previous[1] + Math.cos(spread) * Math.cos(angle) * length, previous[2] + Math.sin(angle) * length])
  })
  return points
}

export function segmentDistance(a: Vec3, b: Vec3, p: Vec3): number {
  const d = b.map((v, i) => v - a[i]), denominator = d.reduce((s, v) => s + v * v, 0)
  const t = denominator ? clamp(d.reduce((s, v, i) => s + (p[i] - a[i]) * v, 0) / denominator) : 0
  return Math.hypot(...a.map((v, i) => v + t * d[i] - p[i]))
}

export function clearance(finger: FingerConfig, amount: number, opposition: number): number {
  const points = fingerPoints(finger, amount, opposition)
  return Math.min(...points.slice(1).map((p, i) => segmentDistance(points[i], p, rig.ball.center as Vec3))) - rig.ball.radius - finger.collision_radius
}

export function solveFinger(finger: FingerConfig, command: number, opposition: number, ball: boolean): Pose {
  command = clamp(command)
  let amount = command, contact = false
  if (ball) {
    // Stop at the first contact along this prescribed joint-coupling path.
    let safe = 0
    for (let step = 0; step <= 64; step++) {
      const next = command * step / 64
      if (clearance(finger, next, opposition) <= 0) {
        let low = safe, high = next
        for (let i = 0; i < 18; i++) { const mid = (low + high) / 2; if (clearance(finger, mid, opposition) > 0) low = mid; else high = mid }
        amount = low; contact = true; break
      }
      safe = next
    }
  }
  const angles = finger.limits.map(limit => limit * amount)
  const pull = angles.reduce((sum, angle, i) => sum + finger.arms_mm[i] * angle * rad, 0)
  return { command, amount, angles, points: fingerPoints(finger, amount, opposition), pull, drumAngle: pull / rig.drum_radius_mm / rad, contact }
}

export function solveHand(commands: Commands, opposition: number, ball: boolean): Record<FingerId, Pose> {
  return Object.fromEntries(rig.fingers.map(finger => [finger.id, solveFinger(finger, commands[finger.id as FingerId], opposition, ball)])) as Record<FingerId, Pose>
}
