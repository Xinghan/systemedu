export interface RegressionRow {
  id: string
  actual: number
  predicted: number
}

/** All readouts use the same signed convention: prediction minus actual. */
export function regressionEvidence(rows: RegressionRow[]) {
  if (!rows.length) throw new Error("At least one sample is required")
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Sample IDs must be unique")
  const values = rows.map(row => {
    if (!row.id || !Number.isFinite(row.actual) || !Number.isFinite(row.predicted)) throw new Error("Invalid regression sample")
    const error = row.predicted - row.actual
    return { ...row, error, absolute: Math.abs(error), squared: error * error }
  })
  const sum = (key: "error" | "absolute" | "squared") => values.reduce((total, row) => total + row[key], 0)
  return {
    rows: values,
    n: values.length,
    meanError: sum("error") / values.length,
    sumAbsolute: sum("absolute"),
    sumSquared: sum("squared"),
    mae: sum("absolute") / values.length,
    rmse: Math.sqrt(sum("squared") / values.length),
    largest: values.reduce((a, b) => a.absolute >= b.absolute ? a : b),
  }
}

export function withPrediction(rows: RegressionRow[], id: string, predicted: number) {
  if (!rows.some(row => row.id === id) || !Number.isFinite(predicted)) throw new Error("Invalid prediction edit")
  return rows.map(row => row.id === id ? { ...row, predicted } : { ...row })
}

export function formatRegression(value: number, digits = 3) {
  const rounded = Number(value.toFixed(digits))
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

export function signedRegression(value: number) {
  return (value > 0 ? "+" : "") + formatRegression(value)
}

export function answerMatches(input: string, expected: number, tolerance = 0.011) {
  return input.trim() !== "" && Number.isFinite(Number(input)) && Math.abs(Number(input) - expected) < tolerance
}
