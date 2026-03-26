import { z } from "zod/v3";
import {
	LexicalCaseSchema,
	LexicalGenusSchema,
	LexicalNumberSchema,
} from "../../schema-primitives";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	cells: z.array(
		z.object({
			article: z.string(),
			case: LexicalCaseSchema,
			form: z.string(),
			number: LexicalNumberSchema,
		}),
	),
	genus: LexicalGenusSchema,
});

export const nounInflectionSchemas = { agentOutputSchema, userInputSchema };
