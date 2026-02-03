// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishToEnglishTranslatePrompt from "./codegen/generated-promts/english/english/translate-prompt";
import * as germanToEnglishTranslatePrompt from "./codegen/generated-promts/german/english/translate-prompt";
import * as germanToRussianTranslatePrompt from "./codegen/generated-promts/german/russian/translate-prompt";
import type { AvaliablePromptDict } from "./types";

export const PROMPT_FOR = {
	English: {
		English: {
			Translate: englishToEnglishTranslatePrompt,
		},
		Russian: {
			Translate: englishToEnglishTranslatePrompt,
		},
	},
	German: {
		English: {
			Translate: germanToEnglishTranslatePrompt,
		},
		Russian: {
			Translate: germanToRussianTranslatePrompt,
		},
	},
} satisfies AvaliablePromptDict;

export { type AgentOutput, SchemasFor, type UserInput } from "./schemas";
