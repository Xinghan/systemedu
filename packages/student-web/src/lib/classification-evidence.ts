/** Counts are the source of truth. Never derive a ranking AUC from one matrix. */
export function classificationCounts(total: number, positives: number, tp: number, fp: number) {
  if (![total, positives, tp, fp].every(Number.isInteger) || total < 2 || positives < 1 || positives >= total || tp < 0 || tp > positives || fp < 0 || fp > total - positives) {
    throw new Error("Invalid binary-classification counts")
  }
  const fn = positives - tp
  const tn = total - positives - fp
  return { tp, fp, fn, tn, total, positives, accuracy: (tp + tn) / total, recall: tp / positives, precision: tp + fp ? tp / (tp + fp) : null }
}

export function percent(value: number) {
  return `${Number((value * 100).toFixed(1))}%`
}
