import { z } from "zod/v3";

const userInputSchema = z.string().describe("Text to translate");
const agentOutputSchema = z.string().describe("Translated text");

export const translateSchemas = {
	agentOutputSchema,
	userInputSchema,
};
