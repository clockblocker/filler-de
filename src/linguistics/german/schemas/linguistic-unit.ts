import { z } from "zod/v3";
import { PhrasemSurfaceSchema } from "../../common/dto/phrasem-surface";
import { GermanLexemSurfaceSchema } from "./lexem-surface";
import { GermanMorphemSurfaceSchema } from "./morphem-surface";

export const GermanLinguisticUnitSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("Lexem"),
		surface: GermanLexemSurfaceSchema,
	}),
	z.object({
		kind: z.literal("Phrasem"),
		surface: PhrasemSurfaceSchema,
	}),
	z.object({
		kind: z.literal("Morphem"),
		surface: GermanMorphemSurfaceSchema,
	}),
]);
export type GermanLinguisticUnit = z.infer<typeof GermanLinguisticUnitSchema>;
