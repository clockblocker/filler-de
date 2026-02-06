import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

/**
 * Each row represents one inflection dimension (e.g. a grammatical case, tense, or degree).
 * `label` identifies the row (e.g. "N", "A", "G", "D" for noun cases; "Präsens", "Präteritum" for verb tenses).
 * `forms` contains the inflected forms as a comma-separated string with wikilinks.
 */
const agentOutputSchema = z.object({
	rows: z.array(
		z.object({
			forms: z.string(),
			label: z.string(),
		}),
	),
});

export const inflectionSchemas = { agentOutputSchema, userInputSchema };
