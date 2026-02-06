import { z } from "zod/v3";
import { MorphemeKindSchema } from "../../linguistics/common/enums/linguistic-units/morphem/morpheme-kind";
import { MorphemeTagSchema } from "../../linguistics/common/enums/linguistic-units/morphem/morpheme-tag";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	morphemes: z.array(
		z.object({
			kind: MorphemeKindSchema,
			lemma: z.string().nullable().optional(),
			surf: z.string(),
			tags: z.array(MorphemeTagSchema).nullable().optional(),
		}),
	),
});

export const morphemSchemas = { agentOutputSchema, userInputSchema };
