import { z } from "zod";

export const KnownLanguageSchema = z.enum(["Russian", "English"]);
export type KnownLanguage = z.infer<typeof KnownLanguageSchema>;
export const KnownLanguage = KnownLanguageSchema.enum;
export const ALL_KNOWN_LANGUAGES = KnownLanguageSchema.options;

export const TargetLanguageSchema = z.enum(["English", "German"]);
export type TargetLanguage = z.infer<typeof TargetLanguageSchema>;
export const TargetLanguage = TargetLanguageSchema.enum;
export const ALL_TARGET_LANGUAGES = TargetLanguageSchema.options;
