import { describe, expect, it } from "vitest";
import { envelopeAlign } from "../src/align/envelope.js";

function makeWav(samples: Int16Array, sampleRate = 16000): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = samples.byteLength;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer)]);
}

describe("envelopeAlign", () => {
  it("returns SIL frames for silent audio", () => {
    const silence = new Int16Array(16000);
    const wav = makeWav(silence);
    const frames = envelopeAlign(wav, "wav", 1000);
    expect(frames.every((f) => f.viseme === "SIL")).toBe(true);
  });

  it("opens mouth (non-SIL) when loud", () => {
    const loud = new Int16Array(16000);
    for (let i = 0; i < loud.length; i++) loud[i] = Math.round(Math.sin(i * 0.1) * 20000);
    const wav = makeWav(loud);
    const frames = envelopeAlign(wav, "wav", 1000);
    expect(frames.some((f) => f.viseme !== "SIL" && f.weight > 0.2)).toBe(true);
  });

  it("returns frames spanning duration", () => {
    const samples = new Int16Array(16000);
    const wav = makeWav(samples);
    const frames = envelopeAlign(wav, "wav", 1000);
    expect(frames[0]!.t_ms).toBe(0);
    expect(frames[frames.length - 1]!.t_ms).toBeLessThanOrEqual(1000);
  });
});
