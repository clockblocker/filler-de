import { z } from "zod/v3";
import {
	GermanVerbConjugationSchema,
	GermanVerbValencySchema,
} from "../../linguistics/de/lexem/verb/features";
import { featurePromptUserInputSchema } from "./feature-shared";

const userInputSchema = featurePromptUserInputSchema;
const agentOutputSchema = z
	.object({
		conjugation: GermanVerbConjugationSchema,
		valency: GermanVerbValencySchema,
	})
	.strict();

export const featuresVerbSchemas = {
	agentOutputSchema,
	userInputSchema,
};
