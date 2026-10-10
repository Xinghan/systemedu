import films from "./biomed-stage-films.json"

// Separate from the old silent storyboard; watching never marks lessons complete.
const seen = new Set<string>()
const key = (owner: string, station: string) => `systemedu:biomed-stage-film:v2:${owner}:${station}`
export function hasSeenBiomedFilm(owner: string, station: string) {
  const id = key(owner, station)
  if (seen.has(id)) return true
  try { return localStorage.getItem(id) === "seen" } catch { return false }
}
export function rememberBiomedFilm(owner: string, station: string) {
  const id = key(owner, station)
  seen.add(id)
  try { localStorage.setItem(id, "seen") } catch { /* In-memory deduplication remains available. */ }
}
export function biomedStageFilm(station: string) {
  const film = films.find(f => f.station === station)!
  return { ...film, poster: `/mission/biomedicine/video/posters/${film.frame}-v2.webp`, src: `/mission/biomedicine/video/${station}-v2.mp4`, captions: `/mission/biomedicine/video/${station}-zh-v2.vtt` }
}
