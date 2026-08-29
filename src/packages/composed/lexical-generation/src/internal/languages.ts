import { z } from "zod/v3";

const KnownLanguageSchema = z.enum(["English", "Russian"]);
export type KnownLanguage = z.infer<typeof KnownLanguageSchema>;

const TargetLanguageSchema = z.enum(["German", "English"]);
export type TargetLanguage = z.infer<typeof TargetLanguageSchema>;
