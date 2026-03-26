import type { KnownLanguage, TargetLanguage } from "../shared/languages";
import type { PromptKind } from "./codegen/consts";

export type AvaliablePromptDict = Record<
	TargetLanguage,
	Record<
		KnownLanguage,
		Record<
			PromptKind,
			{
				systemPrompt: string;
			}
		>
	>
>;
