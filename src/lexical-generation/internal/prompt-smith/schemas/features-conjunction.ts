import {
	featurePromptAgentOutputSchema,
	featurePromptUserInputSchema,
} from "./feature-shared";

const userInputSchema = featurePromptUserInputSchema;
const agentOutputSchema = featurePromptAgentOutputSchema;

export const featuresConjunctionSchemas = {
	agentOutputSchema,
	userInputSchema,
};
