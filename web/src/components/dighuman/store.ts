// Ported (subset) from ~/Dev/systemdighuman/packages/client/src/store.ts
// Two stores: avatar blendshape weights (drives mouth picker) + playback state.
"use client"

import { create } from "zustand"
import type { VisemeFrame } from "./shared/visemes"

interface AvatarState {
  blendshapeWeights: Record<string, number>
  setBlendshapeWeight: (name: string, weight: number) => void
  resetBlendshapes: () => void
}

interface PlaybackState {
  isSpeaking: boolean
  currentUtteranceId: string | null
  visemeTrack: VisemeFrame[]
  subtitleText: string
  setSpeaking: (id: string | null) => void
  setVisemeTrack: (track: VisemeFrame[]) => void
  setSubtitleText: (text: string) => void
}

export const useDighumanAvatarStore = create<AvatarState>((set) => ({
  blendshapeWeights: {},
  setBlendshapeWeight: (name, weight) =>
    set((s) => ({ blendshapeWeights: { ...s.blendshapeWeights, [name]: weight } })),
  resetBlendshapes: () => set({ blendshapeWeights: {} }),
}))

export const useDighumanPlaybackStore = create<PlaybackState>((set) => ({
  isSpeaking: false,
  currentUtteranceId: null,
  visemeTrack: [],
  subtitleText: "",
  setSpeaking: (id) => set({ isSpeaking: id !== null, currentUtteranceId: id }),
  setVisemeTrack: (track) => set({ visemeTrack: track }),
  setSubtitleText: (text) => set({ subtitleText: text }),
}))
