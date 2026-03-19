"use client"

import { create } from "zustand"

export type SemanticLayer = "overview" | "milestone" | "detail"

interface ViewportState {
  zoom: number
  layer: SemanticLayer
  setZoom: (zoom: number) => void
}

function zoomToLayer(zoom: number): SemanticLayer {
  if (zoom < 0.5) return "overview"
  if (zoom <= 1.0) return "milestone"
  return "detail"
}

export const useViewportStore = create<ViewportState>((set) => ({
  zoom: 1,
  layer: "milestone",
  setZoom: (zoom) =>
    set((state) => {
      const layer = zoomToLayer(zoom)
      if (state.layer === layer && state.zoom === zoom) return state
      return { zoom, layer }
    }),
}))
