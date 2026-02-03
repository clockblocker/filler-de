import type z from "zod";
import type { TargetLanguage } from "../types";
import type { PromptKind } from "./codegen/consts";

export type AvaliablePromptDict = Record<
	PromptKind,
	Record<
		TargetLanguage,
		{
			userInputShema: z.ZodTypeAny;
			outputSchema: z.ZodTypeAny;
			systemPrompt: string;
		}
	>
>;
