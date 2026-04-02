import { z } from "zod/v3";
import type { TargetLanguage } from "../languages";

export const LANGUAGE_ISO_CODE: Record<TargetLanguage, string> = {
	English: "en",
	German: "de",
};

const linguisticUnitKinds = ["Phrasem", "Lexem", "Morphem"] as const;

export const LinguisticUnitKindSchema = z.enum(linguisticUnitKinds);
export type LinguisticUnitKind = z.infer<typeof LinguisticUnitKindSchema>;
export const LinguisticUnitKind = LinguisticUnitKindSchema.enum;
export const LINGUISTIC_UNIT_KINDS = LinguisticUnitKindSchema.options;

// Variant is like color vs colour, email vs e-mail.
// Partial means the selected surface covers only part of a multi-word lemma.
const surfaceKinds = ["Lemma", "Inflected", "Variant", "Partial"] as const;

export const SurfaceKindSchema = z.enum(surfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKindSchema>;
export const SurfaceKind = SurfaceKindSchema.enum;
export const SURFACE_KINDS = SurfaceKindSchema.options;
