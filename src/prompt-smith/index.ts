// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishToEnglishMorphemPrompt from "./codegen/generated-promts/english/english/morphem-prompt";
import * as englishToEnglishTranslatePrompt from "./codegen/generated-promts/english/english/translate-prompt";
import * as germanToEnglishMorphemPrompt from "./codegen/generated-promts/german/english/morphem-prompt";
import * as germanToEnglishTranslatePrompt from "./codegen/generated-promts/german/english/translate-prompt";
import * as germanToRussianTranslatePrompt from "./codegen/generated-promts/german/russian/translate-prompt";
import type { AvaliablePromptDict } from "./types";

export const PROMPT_FOR = {
	English: {
		English: {
			Morphem: englishToEnglishMorphemPrompt,
			Translate: englishToEnglishTranslatePrompt,
		},
		Russian: {
			Morphem: englishToEnglishMorphemPrompt,
			Translate: englishToEnglishTranslatePrompt,
		},
	},
	German: {
		English: {
			Morphem: germanToEnglishMorphemPrompt,
			Translate: germanToEnglishTranslatePrompt,
		},
		Russian: {
			Morphem: germanToEnglishMorphemPrompt,
			Translate: germanToRussianTranslatePrompt,
		},
	},
} satisfies AvaliablePromptDict;

export { type AgentOutput, SchemasFor, type UserInput } from "./schemas";
