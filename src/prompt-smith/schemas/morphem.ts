import { z } from "zod/v3";
import { GermanMorphemeKindSchema } from "../../linguistics/de/morphem/de-morphem-kind";
import { SeparabilitySchema } from "../../linguistics/de/morphem/prefix/features";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	morphemes: z.array(
		z.object({
			kind: GermanMorphemeKindSchema,
			lemma: z.string().nullable().optional(),
			separability: SeparabilitySchema.nullable().optional(),
			surf: z.string(),
		}),
	),
});

export type LlmMorpheme = z.infer<
	typeof agentOutputSchema
>["morphemes"][number];

export const morphemSchemas = { agentOutputSchema, userInputSchema };
