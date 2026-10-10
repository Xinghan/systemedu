// A browser presentation preference, deliberately separate from learning progress.
export const SPACE_INTRO_SEEN_KEY = "systemedu:mission:space:intro:v1"
let seenInSession = false

export function hasSeenSpaceIntro() {
  try { return seenInSession || localStorage.getItem(SPACE_INTRO_SEEN_KEY) === "1" }
  catch { return seenInSession }
}

export function rememberSpaceIntro() {
  seenInSession = true
  try { localStorage.setItem(SPACE_INTRO_SEEN_KEY, "1") }
  catch { /* Still avoid repeating the introduction during this session. */ }
}
