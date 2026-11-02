import revision from "./lightkurve-language-revision.json"

type RecordRevision = { fingerprint: string; previous: string; choices: Record<string, Record<string, { previous: string[]; current: string[] }>> }
const records: Record<string, RecordRevision> = revision.records
const theories: Record<string, { fingerprint: string; previous: string }> = revision.theories

/** Preserve saved work only for the exact, reviewed language revision. Future content gets its own version. */
export function lightkurveRecordVersion(moduleId: string, fingerprint: string) {
  const entry = records[moduleId]
  return entry?.fingerprint === fingerprint ? entry.previous : fingerprint
}

export function lightkurveTheoryVersion(project: string, moduleId: string, activityId: string, fingerprint: string) {
  if (project !== "lightkurve-transit-detective") return fingerprint
  const entry = theories[moduleId + "/" + activityId]
  return entry?.fingerprint === fingerprint ? entry.previous : fingerprint
}

/** Read old choice wording without rewriting the original answer or submission history. */
export function lightkurveChoiceIndex(moduleId: string, version: string, kind: string, questionId: string, options: string[], answer: string) {
  const exact = options.findIndex((option, index) => answer === (index + 1) + ". " + option)
  if (exact >= 0) return exact
  const entry = records[moduleId], choice = entry?.choices[kind]?.[questionId]
  if (version !== entry?.previous || !choice || options.length !== choice.current.length || !options.every((option, index) => option === choice.current[index])) return -1
  return choice.previous.findIndex((option, index) => answer === (index + 1) + ". " + option)
}
