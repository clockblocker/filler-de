import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	// Ordered path components for a single compound tag.
	// Example: ["maskulin"] → #noun/maskulin
	// Example: ["transitiv", "stark"] → #verb/transitiv/stark
	tags: z.array(z.string().min(1).max(30)).min(1).max(5),
});

export const featuresSchemas = { agentOutputSchema, userInputSchema };
