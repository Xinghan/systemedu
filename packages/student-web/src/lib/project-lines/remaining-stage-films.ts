import films from "./remaining-stage-films.json"
import { stagePresenter } from "./stage-presenter"
import type { RemainingMissionId } from "./remaining-missions"
const seen = new Set<string>()
const key = (mission: string, owner: string, station: string) => `systemedu:${mission}-stage-film:v2:${owner}:${station}`
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
  const presenter = stagePresenter(mission, station)
  return { ...film, ...presenter, dialogue: `${presenter.presenterDialogue}\n\n${film.dialogue}` }
}
