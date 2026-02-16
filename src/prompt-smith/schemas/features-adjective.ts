import { z } from "zod/v3";
import {
	GermanAdjectiveClassificationSchema,
	GermanAdjectiveDistributionSchema,
	GermanAdjectiveGradabilitySchema,
	GermanAdjectiveValencySchema,
} from "../../linguistics/de/lexem/adjective/features";
import { featurePromptUserInputSchema } from "./feature-shared";

const userInputSchema = featurePromptUserInputSchema;
const agentOutputSchema = z
	.object({
		classification: GermanAdjectiveClassificationSchema,
		distribution: GermanAdjectiveDistributionSchema,
		gradability: GermanAdjectiveGradabilitySchema,
		valency: GermanAdjectiveValencySchema,
	})
	.strict();

export const featuresAdjectiveSchemas = { agentOutputSchema, userInputSchema };
