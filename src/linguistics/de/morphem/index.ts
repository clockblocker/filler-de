import { z } from "zod/v3";
import { makeSurfaceSchema } from "../../common/dto/surface-factory";
import { MorphemeKind } from "../../common/enums/linguistic-units/morphem/morpheme-kind";
import { GermanCircumfixFullFeaturesSchema } from "./circumfix/features";
import { GermanDuplifixFullFeaturesSchema } from "./duplifix/features";
import { GermanInterfixFullFeaturesSchema } from "./interfix/features";
import { GermanPrefixFullFeaturesSchema } from "./prefix/features";
import { GermanRootFullFeaturesSchema } from "./root/features";
import { GermanSuffixFullFeaturesSchema } from "./suffix/features";
import { GermanSuffixoidFullFeaturesSchema } from "./suffixoid/features";

const GermanMorphemFullFeaturesSchema = z.discriminatedUnion("morphemeKind", [
	GermanPrefixFullFeaturesSchema,
	GermanRootFullFeaturesSchema,
	GermanSuffixFullFeaturesSchema,
	GermanSuffixoidFullFeaturesSchema,
	GermanCircumfixFullFeaturesSchema,
	GermanInterfixFullFeaturesSchema,
	GermanDuplifixFullFeaturesSchema,
]);

const GermanMorphemRefFeaturesSchema = z.discriminatedUnion("morphemeKind", [
	z.object({ morphemeKind: z.literal(MorphemeKind.Prefix) }),
	z.object({ morphemeKind: z.literal(MorphemeKind.Root) }),
	z.object({ morphemeKind: z.literal(MorphemeKind.Suffix) }),
	z.object({ morphemeKind: z.literal(MorphemeKind.Suffixoid) }),
	z.object({ morphemeKind: z.literal(MorphemeKind.Circumfix) }),
	z.object({ morphemeKind: z.literal(MorphemeKind.Interfix) }),
	z.object({ morphemeKind: z.literal(MorphemeKind.Duplifix) }),
]);

export const GermanMorphemSurfaceSchema = makeSurfaceSchema(
	GermanMorphemFullFeaturesSchema,
	GermanMorphemRefFeaturesSchema,
);
export type GermanMorphemSurface = z.infer<typeof GermanMorphemSurfaceSchema>;
