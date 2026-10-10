/** Only lines with an implemented mission hub bypass the catalogue detail view. */
export const SPACE_MISSION_HREF = "/mission/space"
export function projectLineMissionHref(id: string) {
  return id === "space-exploration" ? SPACE_MISSION_HREF : id === "biomedicine" ? "/mission/biomedicine" : id === "energy-motion" ? "/mission/energy" : undefined
}
