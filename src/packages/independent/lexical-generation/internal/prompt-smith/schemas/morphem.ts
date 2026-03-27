import { z } from "zod/v3";
import {
	LexicalMorphemeKindSchema,
	SeparabilitySchema,
} from "../../schema-primitives";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	compounded_from: z.array(z.string()).nullable().optional(),
	derived_from: z
		.object({
			derivation_type: z.string(),
			lemma: z.string(),
		})
		.nullable()
		.optional(),
	morphemes: z.array(
		z.object({
			kind: LexicalMorphemeKindSchema,
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
