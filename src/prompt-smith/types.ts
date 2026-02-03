import type z from "zod";
import type { TargetLanguage } from "../types";
import type { PromptKind } from "./codegen/consts";

export type AvaliablePromptDict = Record<
	PromptKind,
	Record<
		TargetLanguage,
		{
			userInputSchema: z.ZodTypeAny;
			agentOutputSchema: z.ZodTypeAny;
			systemPrompt: string;
		}
	>
>;
