import films from "./remaining-stage-films.json"
import type { RemainingMissionId } from "./remaining-missions"
const seen = new Set<string>()
const key = (mission: string, owner: string, station: string) => `systemedu:${mission}-stage-film:v1:${owner}:${station}`
export function hasSeenRemainingFilm(mission: string, owner: string, station: string) {
  const id = key(mission, owner, station)
  if (seen.has(id)) return true
  try { return localStorage.getItem(id) === "seen" } catch { return false }
}
export function rememberRemainingFilm(mission: string, owner: string, station: string) {
  const id = key(mission, owner, station); seen.add(id)
  try { localStorage.setItem(id, "seen") } catch { /* Session memory remains available. */ }
}
export function remainingStageFilm(mission: RemainingMissionId, station: string) {
  const film = films[mission].find(f => f.station === station)!
  return { ...film, poster: `/mission/${mission}/stations/${station}-v1-1536.webp`, src: `/mission/${mission}/video/${station}-v1.mp4`, captions: `/mission/${mission}/video/${station}-zh-v1.vtt` }
}
