import { z } from "zod";

export const userInputSchema = z.string().describe("German text to translate");
