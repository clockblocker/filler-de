import { describe, expect, it } from "bun:test";
import { buildLexicalMeta } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "@textfresser/lexical-generation";
import {
	makeLexemeLemmaResult,
	makeLexemeLexicalInfo,
	makePhrasemeLemmaResult,
	makePhrasemeLexicalInfo,
} from "../helpers/native-fixtures";

describe("buildLexicalMeta", () => {
	it("builds lexical meta for lexem lemmas", () => {
		expect(
			buildLexicalMeta(
				makeLexemeLemmaResult({ lemma: "Haus", pos: "NOUN" }),
				makeLexemeLexicalInfo({
					core: {
						status: "ready",
						value: {
							emojiDescription: ["🏠"],
							ipa: "haʊ̯s",
						},
					},
					lemma: "Haus",
					pos: "NOUN",
				}),
			),
		).toEqual({
			emojiDescription: ["🏠"],
			metaTag: "Lexeme|NOUN|Lemma",
		});
	});

	it("builds lexical meta for phrasem lemmas", () => {
		expect(
			buildLexicalMeta(
				makePhrasemeLemmaResult({
					lemma: "auf jeden Fall",
					phrasemeKind: "DiscourseFormula",
				}),
				makePhrasemeLexicalInfo({
					lemma: "auf jeden Fall",
					phrasemeKind: "DiscourseFormula",
					core: {
						status: "ready",
						value: {
							emojiDescription: ["✅"],
							ipa: "aʊ̯f ˈjeːdn̩ fal",
						},
					},
				}),
			),
		).toEqual({
			emojiDescription: ["✅"],
			metaTag: "Phraseme|DiscourseFormula|Lemma",
		});
	});

	it("encodes non-lemma surfaces in metaTag", () => {
		expect(
			buildLexicalMeta(
				makeLexemeLemmaResult({
					lemma: "gehen",
					pos: "VERB",
					spelledSurface: "geht",
					surfaceKind: "Inflection",
				}),
				makeLexemeLexicalInfo({
					lemma: "gehen",
					pos: "VERB",
					spelledSurface: "geht",
					surfaceKind: "Inflection",
				}),
			),
		).toEqual({
			emojiDescription: ["🔧"],
			metaTag: "Lexeme|VERB|Inflection",
		});
	});

	it("falls back to unknown emoji when lexical core is unavailable", () => {
		expect(
			buildLexicalMeta(
				makeLexemeLemmaResult({ lemma: "Haus", pos: "NOUN" }),
				makeLexemeLexicalInfo({
					lemma: "Haus",
					pos: "NOUN",
					core: {
						error: lexicalGenerationError(
							LexicalGenerationFailureKind.FetchFailed,
							"x",
						),
						status: "error",
					},
				}),
			),
		).toEqual({
			emojiDescription: ["❓"],
			metaTag: "Lexeme|NOUN|Lemma",
		});
	});
});
