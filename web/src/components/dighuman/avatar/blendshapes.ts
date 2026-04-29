// Ported from ~/Dev/systemdighuman/packages/client/src/avatar/blendshapes.ts
// Maps a viseme id + intensity to ARKit blendshape weights. The 2D mouth picker
// reads these weights and chooses one of 8 mouth shapes (SIL/AA/OH/IH/UH/PP/FF/E).
import type { VisemeId } from "../shared/visemes"

export type BlendshapeWeights = Record<string, number>

const MAP: Record<VisemeId, Record<string, number>> = {
  SIL: {},
  PP: { mouthClose: 0.9, mouthPressLeft: 0.3, mouthPressRight: 0.3 },
  FF: { mouthRollLower: 0.7, jawOpen: 0.1 },
  TH: { jawOpen: 0.2, tongueOut: 0.4 },
  DD: { jawOpen: 0.25, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  KK: { jawOpen: 0.3, mouthShrugLower: 0.2 },
  CH: { mouthFunnel: 0.5, jawOpen: 0.2 },
  SS: { mouthStretchLeft: 0.4, mouthStretchRight: 0.4, jawOpen: 0.1 },
  NN: { jawOpen: 0.2, mouthShrugUpper: 0.3 },
  RR: { mouthFunnel: 0.4, jawOpen: 0.2 },
  AA: { jawOpen: 1.0, mouthOpen: 1.0, mouthShrugLower: 0.2 },
  E: { jawOpen: 0.4, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 },
  IH: { mouthStretchLeft: 0.5, mouthStretchRight: 0.5 },
  OH: { jawOpen: 0.5, mouthFunnel: 0.6 },
  UH: { mouthFunnel: 0.5, jawOpen: 0.25 },
  UEH: { mouthPucker: 0.7, jawOpen: 0.15 },
}

export function visemeToBlendshapes(v: VisemeId, weight: number): BlendshapeWeights {
  const base = MAP[v]
  const out: BlendshapeWeights = {}
  for (const [name, w] of Object.entries(base)) out[name] = w * weight
  return out
}
