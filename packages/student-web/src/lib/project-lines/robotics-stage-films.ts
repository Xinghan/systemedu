import films from "./robotics-stage-films.json"

// Separate from the old silent storyboard; watching never marks lessons complete.
const seen = new Set<string>()
const key = (owner: string, station: string) => `systemedu:robotics-stage-film:v1:${owner}:${station}`
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
  return { ...film, poster: `/mission/robotics/stations/${film.frame}-v1-1536.webp`, src: `/mission/robotics/video/${station}-v1.mp4`, captions: `/mission/robotics/video/${station}-zh-v1.vtt` }
}
