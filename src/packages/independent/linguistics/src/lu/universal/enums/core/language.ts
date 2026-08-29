import z from "zod/v3";

const TARGET_LANGUAGES = ["German", "English", "Hebrew"] as const;

const TargetLanguageSchema = z.enum(TARGET_LANGUAGES);

export type TargetLanguage = z.infer<typeof TargetLanguageSchema>;
