import { z } from "zod/v3";
import {
	GermanNounFullFeaturesSchema,
	GermanNounRefFeaturesSchema,
} from "./noun";

/**
 * POS literals re-declared in v3 to avoid importing the v4 `pos.ts` module.
 * Must stay in sync with PARTS_OF_SPEECH_STR from `linguistics/common/enums/linguistic-units/lexem/pos.ts`.
 */
const posStubs = [
	"Pronoun",
	"Article",
	"Adjective",
	"Verb",
	"Preposition",
	"Adverb",
	"Particle",
	"Conjunction",
	"InteractionalUnit",
] as const;

// Full feature stubs: just the discriminant, no extra fields
const fullStubs = posStubs.map((pos) => z.object({ pos: z.literal(pos) }));

// Ref feature stubs: same shape — just discriminant
const refStubs = posStubs.map((pos) => z.object({ pos: z.literal(pos) }));

/** Full features across all German POS values (Noun has real fields, rest are stubs). */
export const GermanLexemFullFeaturesSchema = z.discriminatedUnion("pos", [
	GermanNounFullFeaturesSchema,
	...fullStubs,
]);
export type GermanLexemFullFeatures = z.infer<
	typeof GermanLexemFullFeaturesSchema
>;

/** Ref features across all German POS values (just discriminant for each). */
export const GermanLexemRefFeaturesSchema = z.discriminatedUnion("pos", [
	GermanNounRefFeaturesSchema,
	...refStubs,
]);
export type GermanLexemRefFeatures = z.infer<
	typeof GermanLexemRefFeaturesSchema
>;
