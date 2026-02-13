import { z } from "zod/v3";
import { makeSurfaceSchema } from "../../common/dto/surface-factory";
import { MorphemeKind } from "../../common/enums/linguistic-units/morphem/morpheme-kind";
import { GERMAN_MORPHEM_KIND_STUBS } from "./de-morphem-kind";
import { GermanPrefixFullFeaturesSchema } from "./prefix/features";

const fullStubs = GERMAN_MORPHEM_KIND_STUBS.map((kind) =>
	z.object({ morphemeKind: z.literal(kind) }),
);

const GermanMorphemFullFeaturesSchema = z.discriminatedUnion("morphemeKind", [
	GermanPrefixFullFeaturesSchema,
	...fullStubs,
]);

// Ref features: all morpheme kinds are just discriminant
const refPrefix = z.object({ morphemeKind: z.literal(MorphemeKind.Prefix) });

const refStubs = GERMAN_MORPHEM_KIND_STUBS.map((kind) =>
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
