// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishToRussianTranslatePrompt from "./codegen/generated-promts/english/russian/translate-prompt";
import * as englishToEnglishTranslatePrompt from "./codegen/generated-promts/english/english/translate-prompt";
import * as germanToRussianTranslatePrompt from "./codegen/generated-promts/german/russian/translate-prompt";
import * as germanToEnglishTranslatePrompt from "./codegen/generated-promts/german/english/translate-prompt";
import type { AvaliablePromptDict } from "./types";

export const PromptFor = {
	English: {
		Russian: {
			Translate: englishToRussianTranslatePrompt,
		},
		English: {
			Translate: englishToEnglishTranslatePrompt,
		},
	},
	German: {
		Russian: {
			Translate: germanToRussianTranslatePrompt,
		},
		English: {
			Translate: germanToEnglishTranslatePrompt,
		},
	},
} satisfies AvaliablePromptDict;

export { SchemasFor, type UserInput, type AgentOutput } from "./schemas";
