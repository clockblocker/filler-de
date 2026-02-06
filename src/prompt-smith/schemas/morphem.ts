import { z } from "zod/v3";
import { MorphemeKindSchema } from "../../linguistics/enums/linguistic-units/morphem/morpheme-kind";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	morphemes: z.array(
		z.object({
			kind: MorphemeKindSchema,
			morpheme: z.string(),
		}),
	),
});

export const morphemSchemas = { agentOutputSchema, userInputSchema };
