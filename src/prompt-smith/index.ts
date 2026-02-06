// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishToEnglishHeaderPrompt from "./codegen/generated-promts/english/english/header-prompt";
import * as englishToEnglishLemmaPrompt from "./codegen/generated-promts/english/english/lemma-prompt";
import * as englishToEnglishMorphemPrompt from "./codegen/generated-promts/english/english/morphem-prompt";
import * as englishToEnglishRelationPrompt from "./codegen/generated-promts/english/english/relation-prompt";
import * as englishToEnglishTranslatePrompt from "./codegen/generated-promts/english/english/translate-prompt";
import * as germanToEnglishHeaderPrompt from "./codegen/generated-promts/german/english/header-prompt";
import * as germanToEnglishLemmaPrompt from "./codegen/generated-promts/german/english/lemma-prompt";
import * as germanToEnglishMorphemPrompt from "./codegen/generated-promts/german/english/morphem-prompt";
import * as germanToEnglishRelationPrompt from "./codegen/generated-promts/german/english/relation-prompt";
import * as germanToEnglishTranslatePrompt from "./codegen/generated-promts/german/english/translate-prompt";
import * as germanToRussianTranslatePrompt from "./codegen/generated-promts/german/russian/translate-prompt";
import type { AvaliablePromptDict } from "./types";

export const PROMPT_FOR = {
	English: {
		English: {
			Header: englishToEnglishHeaderPrompt,
			Lemma: englishToEnglishLemmaPrompt,
			Morphem: englishToEnglishMorphemPrompt,
			Relation: englishToEnglishRelationPrompt,
			Translate: englishToEnglishTranslatePrompt,
		},
		Russian: {
			Header: englishToEnglishHeaderPrompt,
			Lemma: englishToEnglishLemmaPrompt,
			Morphem: englishToEnglishMorphemPrompt,
			Relation: englishToEnglishRelationPrompt,
			Translate: englishToEnglishTranslatePrompt,
		},
	},
	German: {
		English: {
			Header: germanToEnglishHeaderPrompt,
			Lemma: germanToEnglishLemmaPrompt,
			Morphem: germanToEnglishMorphemPrompt,
			Relation: germanToEnglishRelationPrompt,
			Translate: germanToEnglishTranslatePrompt,
		},
		Russian: {
			Header: germanToEnglishHeaderPrompt,
			Lemma: germanToEnglishLemmaPrompt,
			Morphem: germanToEnglishMorphemPrompt,
			Relation: germanToEnglishRelationPrompt,
			Translate: germanToRussianTranslatePrompt,
		},
	},
} satisfies AvaliablePromptDict;

export { type AgentOutput, SchemasFor, type UserInput } from "./schemas";
