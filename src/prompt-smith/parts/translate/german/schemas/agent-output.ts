import { z } from "zod";

export const agentOutputSchema = z
	.string()
	.describe("Russian translation of the input");
