import { z } from "zod/v3";
import { MorphemeKind } from "../../../common/enums/linguistic-units/morphem/morpheme-kind";

export const GermanRootFullFeaturesSchema = z.object({
	morphemeKind: z.literal(MorphemeKind.Root),
});
