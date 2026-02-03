import type { TargetLanguage } from "../types";
import type { PromptKind } from "./codegen/consts";

export type AvaliablePromptDict = Record<
	TargetLanguage,
	Record<
		PromptKind,
		{
			systemPrompt: string;
		}
	>
>;
