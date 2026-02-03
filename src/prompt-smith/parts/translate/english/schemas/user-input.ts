import { z } from "zod";

export const userInputSchema = z.string().describe("English text to translate");
