import { z } from "zod/v3";

const linguisticUnitKinds = ["Phrasem", "Lexem", "Morphem"] as const;

export const LinguisticUnitKindSchema = z.enum(linguisticUnitKinds);
export type LinguisticUnitKind = z.infer<typeof LinguisticUnitKindSchema>;
export const LinguisticUnitKind = LinguisticUnitKindSchema.enum;
export const LINGUISTIC_UNIT_KINDS = LinguisticUnitKindSchema.options;

// Variant is like color vs colour, email vs e-mail
const surfaceKinds = ["Lemma", "Inflected", "Variant"] as const;

export const SurfaceKindSchema = z.enum(surfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKindSchema>;
export const SurfaceKind = SurfaceKindSchema.enum;
export const SURFACE_KINDS = SurfaceKindSchema.options;
