// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

import * as englishToEnglishDisambiguatePrompt from "./codegen/generated-promts/english/english/disambiguate-prompt";
import * as englishToEnglishHeaderPrompt from "./codegen/generated-promts/english/english/header-prompt";
import * as englishToEnglishInflectionPrompt from "./codegen/generated-promts/english/english/inflection-prompt";
import * as englishToEnglishLemmaPrompt from "./codegen/generated-promts/english/english/lemma-prompt";
import * as englishToEnglishMorphemPrompt from "./codegen/generated-promts/english/english/morphem-prompt";
import * as englishToEnglishNounInflectionPrompt from "./codegen/generated-promts/english/english/noun-inflection-prompt";
import * as englishToEnglishRelationPrompt from "./codegen/generated-promts/english/english/relation-prompt";
import * as englishToEnglishTranslatePrompt from "./codegen/generated-promts/english/english/translate-prompt";
import * as englishToEnglishWordTranslationPrompt from "./codegen/generated-promts/english/english/word-translation-prompt";
import * as germanToEnglishDisambiguatePrompt from "./codegen/generated-promts/german/english/disambiguate-prompt";
import * as germanToEnglishHeaderPrompt from "./codegen/generated-promts/german/english/header-prompt";
import * as germanToEnglishInflectionPrompt from "./codegen/generated-promts/german/english/inflection-prompt";
import * as germanToEnglishLemmaPrompt from "./codegen/generated-promts/german/english/lemma-prompt";
import * as germanToEnglishMorphemPrompt from "./codegen/generated-promts/german/english/morphem-prompt";
import * as germanToEnglishNounInflectionPrompt from "./codegen/generated-promts/german/english/noun-inflection-prompt";
import * as germanToEnglishRelationPrompt from "./codegen/generated-promts/german/english/relation-prompt";
import * as germanToEnglishTranslatePrompt from "./codegen/generated-promts/german/english/translate-prompt";
import * as germanToEnglishWordTranslationPrompt from "./codegen/generated-promts/german/english/word-translation-prompt";
import * as germanToRussianTranslatePrompt from "./codegen/generated-promts/german/russian/translate-prompt";
import * as germanToRussianWordTranslationPrompt from "./codegen/generated-promts/german/russian/word-translation-prompt";
import type { AvaliablePromptDict } from "./types";

export const PROMPT_FOR = {
	English: {
		English: {
			Disambiguate: englishToEnglishDisambiguatePrompt,
			Header: englishToEnglishHeaderPrompt,
			Inflection: englishToEnglishInflectionPrompt,
			Lemma: englishToEnglishLemmaPrompt,
			Morphem: englishToEnglishMorphemPrompt,
			NounInflection: englishToEnglishNounInflectionPrompt,
			Relation: englishToEnglishRelationPrompt,
			Translate: englishToEnglishTranslatePrompt,
			WordTranslation: englishToEnglishWordTranslationPrompt,
		},
		Russian: {
			Disambiguate: englishToEnglishDisambiguatePrompt,
			Header: englishToEnglishHeaderPrompt,
			Inflection: englishToEnglishInflectionPrompt,
			Lemma: englishToEnglishLemmaPrompt,
			Morphem: englishToEnglishMorphemPrompt,
			NounInflection: englishToEnglishNounInflectionPrompt,
			Relation: englishToEnglishRelationPrompt,
			Translate: englishToEnglishTranslatePrompt,
			WordTranslation: englishToEnglishWordTranslationPrompt,
		},
	},
	German: {
		English: {
			Disambiguate: germanToEnglishDisambiguatePrompt,
			Header: germanToEnglishHeaderPrompt,
			Inflection: germanToEnglishInflectionPrompt,
			Lemma: germanToEnglishLemmaPrompt,
			Morphem: germanToEnglishMorphemPrompt,
			NounInflection: germanToEnglishNounInflectionPrompt,
			Relation: germanToEnglishRelationPrompt,
			Translate: germanToEnglishTranslatePrompt,
			WordTranslation: germanToEnglishWordTranslationPrompt,
		},
		Russian: {
			Disambiguate: germanToEnglishDisambiguatePrompt,
			Header: germanToEnglishHeaderPrompt,
			Inflection: germanToEnglishInflectionPrompt,
			Lemma: germanToEnglishLemmaPrompt,
			Morphem: germanToEnglishMorphemPrompt,
			NounInflection: germanToEnglishNounInflectionPrompt,
			Relation: germanToEnglishRelationPrompt,
			Translate: germanToRussianTranslatePrompt,
			WordTranslation: germanToRussianWordTranslationPrompt,
		},
	},
} satisfies AvaliablePromptDict;

export { type AgentOutput, SchemasFor, type UserInput } from "./schemas";
