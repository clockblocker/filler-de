import { z } from "zod/v3";
import { MorphemeKind } from "../../../common/enums/linguistic-units/morphem/morpheme-kind";

const separabilityValues = ["Separable", "Inseparable"] as const;
export const SeparabilitySchema = z.enum(separabilityValues);
export type Separability = z.infer<typeof SeparabilitySchema>;

export const GermanPrefixFullFeaturesSchema = z.object({
	morphemeKind: z.literal(MorphemeKind.Prefix),
	separability: SeparabilitySchema,
});
