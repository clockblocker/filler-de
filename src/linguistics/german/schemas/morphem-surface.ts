import { z } from "zod/v3";
import { makeSurfaceSchema } from "../../common/dto/surface-factory";

const separabilityValues = ["Separable", "Inseparable"] as const;
export const SeparabilitySchema = z.enum(separabilityValues);

/**
 * Morpheme kind literals re-declared in v3 to avoid importing v4 morpheme-kind.ts.
 * Must stay in sync with `morphemeKinds` from `linguistics/common/enums/linguistic-units/morphem/morpheme-kind.ts`.
 */
const morphemStubs = [
	"Root",
	"Suffix",
	"Suffixoid",
	"Infix",
	"Circumfix",
	"Interfix",
	"Transfix",
	"Clitic",
	"ToneMarking",
	"Duplifix",
] as const;

const fullPrefix = z.object({
	morphemeKind: z.literal("Prefix"),
	separability: SeparabilitySchema,
});

const fullStubs = morphemStubs.map((kind) =>
	z.object({ morphemeKind: z.literal(kind) }),
);

const GermanMorphemFullFeaturesSchema = z.discriminatedUnion("morphemeKind", [
	fullPrefix,
	...fullStubs,
]);

// Ref features: all morpheme kinds are just discriminant
const refPrefix = z.object({ morphemeKind: z.literal("Prefix") });

const refStubs = morphemStubs.map((kind) =>
	z.object({ morphemeKind: z.literal(kind) }),
);

const GermanMorphemRefFeaturesSchema = z.discriminatedUnion("morphemeKind", [
	refPrefix,
	...refStubs,
]);

export const GermanMorphemSurfaceSchema = makeSurfaceSchema(
	GermanMorphemFullFeaturesSchema,
	GermanMorphemRefFeaturesSchema,
);
export type GermanMorphemSurface = z.infer<typeof GermanMorphemSurfaceSchema>;
