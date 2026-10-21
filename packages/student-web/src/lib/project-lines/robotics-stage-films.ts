import films from "./robotics-stage-films.json"
import { stagePresenter } from "./stage-presenter"

// Separate from the old silent storyboard; watching never marks lessons complete.
const seen = new Set<string>()
const key = (owner: string, station: string) => `systemedu:robotics-stage-film:v2:${owner}:${station}`
export function hasSeenRoboticsFilm(owner: string, station: string) {
  const id = key(owner, station)
  if (seen.has(id)) return true
  try { return localStorage.getItem(id) === "seen" } catch { return false }
}
export function rememberRoboticsFilm(owner: string, station: string) {
  const id = key(owner, station)
  seen.add(id)
  try { localStorage.setItem(id, "seen") } catch { /* In-memory deduplication remains available. */ }
}
export function roboticsStageFilm(station: string) {
  const film = films.find(f => f.station === station)!
  const presenter = stagePresenter("robotics", station)
  return { ...film, ...presenter, dialogue: `${presenter.presenterDialogue}\n\n${film.dialogue}` }
}
