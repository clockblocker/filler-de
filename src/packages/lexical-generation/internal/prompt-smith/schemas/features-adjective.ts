import { z } from "zod/v3";
import {
	LexicalAdjectiveClassificationSchema,
	LexicalAdjectiveDistributionSchema,
	LexicalAdjectiveGradabilitySchema,
	LexicalAdjectiveValencySchema,
} from "../../schema-primitives";
import { featurePromptUserInputSchema } from "./feature-shared";

const userInputSchema = featurePromptUserInputSchema;
const agentOutputSchema = z
	.object({
		classification: LexicalAdjectiveClassificationSchema,
		distribution: LexicalAdjectiveDistributionSchema,
		gradability: LexicalAdjectiveGradabilitySchema,
		valency: LexicalAdjectiveValencySchema,
	})
	.strict();

export const featuresAdjectiveSchemas = { agentOutputSchema, userInputSchema };
