import type { z } from "zod/v3";
import { makeSurfaceSchema } from "../../common/dto/surface-factory";
import {
	GermanLexemFullFeaturesSchema,
	GermanLexemRefFeaturesSchema,
} from "../features/pos-features";

export const GermanLexemSurfaceSchema = makeSurfaceSchema(
	GermanLexemFullFeaturesSchema,
	GermanLexemRefFeaturesSchema,
);
export type GermanLexemSurface = z.infer<typeof GermanLexemSurfaceSchema>;
