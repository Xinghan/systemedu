import { z } from "zod";
import { VISEMES } from "./visemes.js";

export const LangSchema = z.enum(["en", "zh"]);
export type Lang = z.infer<typeof LangSchema>;

export const HelloFrameSchema = z.object({
  type: z.literal("hello"),
  session_id: z.string().min(1),
});

export const ResyncFrameSchema = z.object({
  type: z.literal("resync"),
  session_id: z.string().min(1),
});

export const ClientFrameSchema = z.discriminatedUnion("type", [
  HelloFrameSchema,
  ResyncFrameSchema,
]);

export const SpeechStartFrameSchema = z.object({
  type: z.literal("speech_start"),
  utterance_id: z.string().min(1),
  duration_ms: z.number().nonnegative(),
  lang: LangSchema,
});

export const AudioHeaderFrameSchema = z.object({
  type: z.literal("audio_header"),
  utterance_id: z.string().min(1),
  codec: z.enum(["mp3", "opus", "wav"]),
  byte_length: z.number().int().positive(),
});

export const VisemeFrameSchema = z.object({
  t_ms: z.number().nonnegative(),
  viseme: z.enum(VISEMES),
  weight: z.number().min(0).max(1),
});

export const VisemeTrackFrameSchema = z.object({
  type: z.literal("viseme_track"),
  utterance_id: z.string().min(1),
  frames: z.array(VisemeFrameSchema),
});

export const SpeechEndFrameSchema = z.object({
  type: z.literal("speech_end"),
  utterance_id: z.string().min(1),
});

export const SpeechInterruptFrameSchema = z.object({
  type: z.literal("speech_interrupt"),
  utterance_id: z.string().min(1),
});

export const ErrorFrameSchema = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  message: z.string(),
});

export const ServerFrameSchema = z.discriminatedUnion("type", [
  SpeechStartFrameSchema,
  AudioHeaderFrameSchema,
  VisemeTrackFrameSchema,
  SpeechEndFrameSchema,
  SpeechInterruptFrameSchema,
  ErrorFrameSchema,
]);

export type ClientFrame = z.infer<typeof ClientFrameSchema>;
export type ServerFrame = z.infer<typeof ServerFrameSchema>;
export type VisemeFrame = z.infer<typeof VisemeFrameSchema>;

export const SpeakRequestSchema = z.object({
  session_id: z.string().min(1),
  text: z.string().min(1).max(4000),
  lang: LangSchema,
  voice_id: z.string().optional(),
  utterance_id: z.string().optional(),
});

export const StopRequestSchema = z.object({
  session_id: z.string().min(1),
  utterance_id: z.string().optional(),
});

export type SpeakRequest = z.infer<typeof SpeakRequestSchema>;
export type StopRequest = z.infer<typeof StopRequestSchema>;
