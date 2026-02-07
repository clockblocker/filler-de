import { z } from "zod/v3";
import { GermanGenusSchema } from "../enums/genus";

const nounClassValues = ["Common", "Proper"] as const;
export const NounClassSchema = z.enum(nounClassValues);
export type NounClass = z.infer<typeof NounClassSchema>;

/** Full features for a Noun Lemma surface — genus + nounClass. */
export const GermanNounFullFeaturesSchema = z.object({
	genus: GermanGenusSchema,
	nounClass: NounClassSchema,
	pos: z.literal("Noun"),
});

/** Ref features for Noun Inflected/Variant — genus lives on the Lemma entry. */
export const GermanNounRefFeaturesSchema = z.object({
	pos: z.literal("Noun"),
});
