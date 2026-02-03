import { z } from "zod";

const userInputSchema = z.string().describe("Text to translate");
const agentOutputSchema = z.string().describe("Translated text");

export const translateSchemas = {
	agentOutputSchema,
	userInputSchema,
};
