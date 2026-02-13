import { z } from "zod/v3";
import { PhrasemSurfaceSchema } from "../common/dto/phrasem-surface";
import { GermanLexemSurfaceSchema } from "./lexem";
import { GermanMorphemSurfaceSchema } from "./morphem";

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

export {
	type GermanLexemSurface,
	GermanLexemSurfaceSchema,
} from "./lexem";
// Barrel exports
export {
	articleFromGenus,
	GermanGenus,
	GermanGenusSchema,
} from "./lexem/noun/features";
export {
	type GermanMorphemSurface,
	GermanMorphemSurfaceSchema,
} from "./morphem";
