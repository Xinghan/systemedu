import type { VisemeId } from "@systemdighuman/shared";

const EN_VOWEL_TO_VISEME: Record<string, VisemeId> = {
  a: "AA",
  e: "E",
  i: "IH",
  o: "OH",
  u: "UH",
  y: "IH",
};

const EN_CONSONANT_TO_VISEME: Record<string, VisemeId> = {
  b: "PP",
  p: "PP",
  m: "PP",
  f: "FF",
  v: "FF",
  t: "DD",
  d: "DD",
  n: "NN",
  k: "KK",
  g: "KK",
  s: "SS",
  z: "SS",
  l: "NN",
  r: "RR",
  h: "AA",
  w: "UH",
  j: "CH",
};

export function englishWordToViseme(word: string): VisemeId {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return "AA";
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const ch = cleaned[i]!;
    const v = EN_VOWEL_TO_VISEME[ch];
    if (v) return v;
  }
  const first = cleaned[0]!;
  return EN_CONSONANT_TO_VISEME[first] ?? "AA";
}

export function chineseWordToViseme(_word: string): VisemeId {
  return "AA";
}
