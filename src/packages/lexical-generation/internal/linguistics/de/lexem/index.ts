import { z } from "zod/v3";
import { makeSurfaceSchema } from "../../common/dto/surface-factory";
import {
	GermanAdjectiveFullFeaturesSchema,
	GermanAdjectiveRefFeaturesSchema,
} from "./adjective/features";
import { GERMAN_POS_STUBS } from "./de-pos";
import {
	GermanNounFullFeaturesSchema,
	GermanNounRefFeaturesSchema,
} from "./noun/features";
import {
	GermanVerbFullFeaturesSchema,
	GermanVerbRefFeaturesSchema,
} from "./verb/features";

// Full feature stubs: just the discriminant, no extra fields
const fullStubs = GERMAN_POS_STUBS.map((pos) =>
	z.object({ pos: z.literal(pos) }),
);

// Ref feature stubs: same shape — just discriminant
const refStubs = GERMAN_POS_STUBS.map((pos) =>
	z.object({ pos: z.literal(pos) }),
);

/** Full features across all German POS values (Noun/Verb/Adjective specialized, rest are stubs). */
export const GermanLexemFullFeaturesSchema = z.discriminatedUnion("pos", [
	GermanNounFullFeaturesSchema,
	GermanAdjectiveFullFeaturesSchema,
	GermanVerbFullFeaturesSchema,
	...fullStubs,
]);
export type GermanLexemFullFeatures = z.infer<
	typeof GermanLexemFullFeaturesSchema
>;

/** Ref features across all German POS values (specialized + discriminant-only refs). */
export const GermanLexemRefFeaturesSchema = z.discriminatedUnion("pos", [
	GermanNounRefFeaturesSchema,
	GermanAdjectiveRefFeaturesSchema,
	GermanVerbRefFeaturesSchema,
	...refStubs,
]);
export type GermanLexemRefFeatures = z.infer<
	typeof GermanLexemRefFeaturesSchema
>;

export const GermanLexemSurfaceSchema = makeSurfaceSchema(
	GermanLexemFullFeaturesSchema,
	GermanLexemRefFeaturesSchema,
);
export type GermanLexemSurface = z.infer<typeof GermanLexemSurfaceSchema>;
