import { z } from "zod/v3";
import { MorphemeKind } from "../../../common/enums/linguistic-units/morphem/morpheme-kind";

export const GermanSuffixFullFeaturesSchema = z.object({
	morphemeKind: z.literal(MorphemeKind.Suffix),
});
