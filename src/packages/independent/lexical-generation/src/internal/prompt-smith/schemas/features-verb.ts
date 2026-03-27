import { z } from "zod/v3";
import {
	LexicalVerbConjugationSchema,
	LexicalVerbValencySchema,
} from "../../schema-primitives";
import { featurePromptUserInputSchema } from "./feature-shared";

const userInputSchema = featurePromptUserInputSchema;
const agentOutputSchema = z
	.object({
		conjugation: LexicalVerbConjugationSchema,
		valency: LexicalVerbValencySchema,
	})
	.strict();

export const featuresVerbSchemas = {
	agentOutputSchema,
	userInputSchema,
};
