// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishTranslatePrompt from "./codegen/generated-promts/translate/english-translate-prompt";
import * as germanTranslatePrompt from "./codegen/generated-promts/translate/german-translate-prompt";
import type { AvaliablePromptDict } from "./types";

export const PromptFor = {
	Translate: {
		English: englishTranslatePrompt,
		German: germanTranslatePrompt,
	},
} satisfies AvaliablePromptDict;
