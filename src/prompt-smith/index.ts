// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishTranslatePrompt from "./codegen/generated-promts/english/translate-prompt";
import * as germanTranslatePrompt from "./codegen/generated-promts/german/translate-prompt";
import type { AvaliablePromptDict } from "./types";

export const PromptFor = {
	English: {
		Translate: englishTranslatePrompt,
	},
	German: {
		Translate: germanTranslatePrompt,
	},
} satisfies AvaliablePromptDict;

export { SchemasFor, type UserInput, type AgentOutput } from "./schemas";
