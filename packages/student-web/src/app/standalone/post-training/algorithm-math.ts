/** Small, deterministic teaching models. These are not model training benchmarks. */
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const dot = (a: number[], b: number[]) => sum(a.map((x, i) => x * b[i]));
export const matvec = (a: number[][], x: number[]) => a.map(row => dot(row, x));
export const softmax = (z: number[]) => { const m = Math.max(...z); const e = z.map(v => Math.exp(v - m)); const d = sum(e); return e.map(v => v / d); };
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const softplus = (x: number) => Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x)));
export const ce = (z: number[], target: number) => { const m = Math.max(...z); return m + Math.log(sum(z.map(v => Math.exp(v - m)))) - z[target]; };
export function preference(margin: number, reference: number, beta: number) {
    const z = beta * (margin - reference), p = sigmoid(z);
    return { z, p, loss: softplus(-z), gradient: beta * (p - 1) };
}
export function lora(rank: number, alpha: number, x: number[]) {
    const W = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], A = [[1, 0, 1], [0, 1, -1]].slice(0, rank), B = [[1, 0], [2, 1], [0, 1]].map(row => row.slice(0, rank));
    const u = matvec(A, x), delta = matvec(B, u).map(v => v * alpha / rank), base = matvec(W, x);
    return { W, A, B, u, delta, base, y: base.map((v, i) => v + delta[i]), BA: B.map(row => [0, 1, 2].map(j => sum(row.map((b, k) => b * A[k][j])))) };
}
// bitsandbytes NF4 lookup values (rounded here to 8 significant digits).
export const NF4 = [-1, -.6961928, -.52507305, -.39491749, -.28444138, -.18477343, -.09105004, 0, .0795803, .1609302, .2461123, .33791524, .44070983, .562617, .72295684, 1];
export function quantize(values: number[], uniform = false) {
    const codebook = uniform ? Array.from({ length: 16 }, (_, i) => -1 + 2 * i / 15) : NF4;
    const scale = Math.max(...values.map(Math.abs)) || 1;
    const normalized = values.map(v => v / scale);
    const codes = normalized.map(v => codebook.reduce((best, x, i) => Math.abs(x - v) < Math.abs(codebook[best] - v) ? i : best, 0));
    const restored = codes.map(c => codebook[c] * scale);
    return { scale, normalized, codes, restored, errors: restored.map((v, i) => v - values[i]), mse: sum(restored.map((v, i) => (v - values[i]) ** 2)) / values.length };
}
export function adamTrajectory(lr: number, clip: number, decay: number, steps = 8) {
    let w = 2, m = 0, v = 0;
    const rows = [];
    for (let t = 1; t <= steps; t++) {
        const raw = w, g = raw * Math.min(1, clip / (Math.abs(raw) + 1e-12));
        m = .9 * m + .1 * g;
        v = .999 * v + .001 * g * g;
        const mh = m / (1 - .9 ** t), vh = v / (1 - .999 ** t), before = w;
        w = w * (1 - lr * decay) - lr * mh / (Math.sqrt(vh) + 1e-8);
        rows.push({ t, before, raw, g, m, v, mh, vh, w, loss: w * w / 2 });
    }
    return rows;
}
export function classification(truth: number[], pred: number[]) {
    const matrix = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
    truth.forEach((t, i) => matrix[t][pred[i] < 0 ? 3 : pred[i]]++);
    const perClass = matrix.map((row, c) => { const tp = row[c], fp = sum(matrix.map(r => r[c])) - tp, fn = sum(row) - tp; return { tp, fp, fn, f1: 2 * tp / (2 * tp + fp + fn || 1) }; });
    return { matrix, perClass, macro: sum(perClass.map(c => c.f1)) / 3, accuracy: sum(truth.map((t, i) => Number(t === pred[i]))) / truth.length, valid: pred.filter(p => p >= 0).length / truth.length };
}
export function bootstrap(a: number[], b: number[], seed: number, count = 200) {
    let state = seed >>> 0;
    const rand = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 2 ** 32; };
    const samples = Array.from({ length: count }, () => { const indices = a.map(() => Math.floor(rand() * a.length)); return { indices, delta: sum(indices.map(i => b[i] - a[i])) / a.length }; });
    const sorted = samples.map(s => s.delta).sort((x, y) => x - y);
    return { samples, low: sorted[Math.floor(.025 * (count - 1))], high: sorted[Math.floor(.975 * (count - 1))], observed: sum(a.map((v, i) => b[i] - v)) / a.length };
}
