import { z } from "zod/v3";
import {
	CaseValueSchema,
	NumberValueSchema,
} from "../../linguistics/common/enums/inflection/feature-values";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	cells: z.array(
		z.object({
			article: z.string(),
			case: CaseValueSchema,
			form: z.string(),
			number: NumberValueSchema,
		}),
	),
});

export const nounInflectionSchemas = { agentOutputSchema, userInputSchema };
