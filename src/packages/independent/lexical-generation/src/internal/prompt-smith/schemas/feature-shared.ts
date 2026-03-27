import { z } from "zod/v3";

export const featurePromptUserInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

export const featurePromptAgentOutputSchema = z.object({
	tags: z.array(z.string().min(1).max(30)).min(1).max(5),
});
