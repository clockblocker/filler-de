import z from "zod/v3";

const collocationStrengths = ["Free", "Bound", "Frozen"] as const;

export const CollocationStrengthSchema = z.enum(collocationStrengths);

export type CollocationStrength = z.infer<typeof CollocationStrengthSchema>;
export const CollocationStrength = CollocationStrengthSchema.enum;
export const COLLOCATION_STRENGTHS = CollocationStrengthSchema.options;
