import { z } from "zod/v3";

export const KnownLanguageSchema = z.enum(["English", "Russian"]);
export type KnownLanguage = z.infer<typeof KnownLanguageSchema>;

export const TargetLanguageSchema = z.enum(["German", "English"]);
export type TargetLanguage = z.infer<typeof TargetLanguageSchema>;
