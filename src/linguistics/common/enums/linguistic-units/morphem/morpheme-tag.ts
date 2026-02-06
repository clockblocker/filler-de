import z from "zod/v3";

const morphemeTags = ["Separable", "Inseparable"] as const;

export const MorphemeTagSchema = z.enum(morphemeTags);

export type MorphemeTag = z.infer<typeof MorphemeTagSchema>;
export const MorphemeTag = MorphemeTagSchema.enum;
export const MORPHEME_TAGS = MorphemeTagSchema.options;
