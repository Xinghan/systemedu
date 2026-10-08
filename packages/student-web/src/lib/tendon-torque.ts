/** SI-unit analytic teaching model; not a hardware safety certification. */
export const KGFCM_TO_NM = 0.0980665
export function torqueNm(forceN: number, radiusCm: number, angleDeg = 90) {
  if (![forceN,radiusCm,angleDeg].every(Number.isFinite) || forceN < 0 || radiusCm < 0 || angleDeg < 0 || angleDeg > 180) throw new Error("Invalid torque parameters")
  return forceN * radiusCm / 100 * Math.sin(angleDeg * Math.PI / 180)
}
export function torqueBudget(forceN: number, radiusCm: number, fingers: number, factor: number) {
  if (!Number.isInteger(fingers) || fingers < 1 || fingers > 5 || !Number.isFinite(factor) || factor < 1) throw new Error("Invalid budget parameters")
  const single = torqueNm(forceN, radiusCm)
  return {single, total: single * fingers, required: single * fingers * factor}
}
export function assessStall(requiredNm: number, stallKgFcm: number) {
  if (![requiredNm,stallKgFcm].every(Number.isFinite) || requiredNm < 0 || stallKgFcm < 0) throw new Error("Invalid rating")
  return requiredNm >= stallKgFcm * KGFCM_TO_NM ? "insufficient" : "unknown"
}
export const torqueFormat = (value: number, digits = 3) => Number(value.toFixed(digits)).toString()
