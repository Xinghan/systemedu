// Ported from ~/Dev/systemdighuman/packages/client/src/playback/scheduler.ts
// Drives blendshape weights from a viseme track timeline. Caller calls tick(now)
// in a rAF loop; scheduler interpolates the right viseme weight at that moment.
import type { VisemeFrame, VisemeId } from "../shared/visemes"
import { visemeToBlendshapes } from "../avatar/blendshapes"

export interface SchedulerOptions {
  onBlendshape: (name: string, weight: number) => void
}

interface InterpolatedViseme {
  viseme: VisemeId
  weight: number
}

export function interpolateVisemeAt(track: VisemeFrame[], tMs: number): InterpolatedViseme {
  if (track.length === 0) return { viseme: "SIL", weight: 0 }
  if (tMs <= track[0]!.t_ms) return { viseme: track[0]!.viseme, weight: track[0]!.weight }

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1]!
    const curr = track[i]!
    if (tMs <= curr.t_ms) {
      if (prev.viseme === curr.viseme && curr.t_ms > prev.t_ms) {
        const k = (tMs - prev.t_ms) / (curr.t_ms - prev.t_ms)
        const weight = prev.weight + (curr.weight - prev.weight) * k
        return { viseme: curr.viseme, weight }
      }
      return { viseme: prev.viseme, weight: prev.weight }
    }
  }
  const last = track[track.length - 1]!
  return { viseme: last.viseme, weight: last.weight }
}

export class PlaybackScheduler {
  private track: VisemeFrame[] = []
  private startMs = 0
  private active = false
  private readonly touched = new Set<string>()

  constructor(private readonly opts: SchedulerOptions) {}

  setTrack(track: VisemeFrame[], startMs: number): void {
    this.track = track
    this.startMs = startMs
    this.active = true
  }

  stop(): void {
    this.active = false
    this.track = []
    this.zeroAll()
  }

  tick(nowMs: number): void {
    if (!this.active) return
    const t = nowMs - this.startMs
    const { viseme, weight } = interpolateVisemeAt(this.track, t)
    this.emit(viseme, weight)
  }

  private emit(viseme: VisemeId, weight: number): void {
    const blends = visemeToBlendshapes(viseme, weight)
    const nowTouched = new Set<string>()
    for (const [name, w] of Object.entries(blends)) {
      this.opts.onBlendshape(name, w)
      nowTouched.add(name)
      this.touched.add(name)
    }
    for (const name of this.touched) {
      if (!nowTouched.has(name)) this.opts.onBlendshape(name, 0)
    }
  }

  private zeroAll(): void {
    for (const name of this.touched) this.opts.onBlendshape(name, 0)
    this.touched.clear()
  }
}
