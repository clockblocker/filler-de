import { describe, expect, it } from "bun:test";
import { dispatchHeaderFormatter } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-dispatch";
import type { LemmaResult } from "../../../../src/commanders/textfresser/commands/lemma/types";
import type { AgentOutput } from "../../../../src/prompt-smith";

type LexemLemmaResult = Extract<LemmaResult, { linguisticUnit: "Lexem" }>;
type PhrasemLemmaResult = Extract<LemmaResult, { linguisticUnit: "Phrasem" }>;

function makeLexemLemmaResult(
	overrides: Partial<LexemLemmaResult> = {},
): LexemLemmaResult {
	return {
		attestation: {
			source: {
				ref: "ref",
				textWithOnlyTargetMarked: "context",
			},
		} as LemmaResult["attestation"],
		disambiguationResult: null,
		lemma: "Test",
		linguisticUnit: "Lexem",
		posLikeKind: "Verb",
		surfaceKind: "Lemma",
		...overrides,
	};
}

function makePhrasemLemmaResult(
	overrides: Partial<PhrasemLemmaResult> = {},
): PhrasemLemmaResult {
	return {
		attestation: {
			source: {
				ref: "ref",
				textWithOnlyTargetMarked: "context",
			},
		} as LemmaResult["attestation"],
		disambiguationResult: null,
		lemma: "Test",
		linguisticUnit: "Phrasem",
		posLikeKind: "DiscourseFormula",
		surfaceKind: "Lemma",
		...overrides,
	};
}

function makeVerbEnrichment(): AgentOutput<"LexemEnrichment"> {
	return {
		emojiDescription: ["🔧"],
		ipa: "tɛst",
		linguisticUnit: "Lexem",
		posLikeKind: "Verb",
	};
}

function makeNounEnrichment(
	overrides: Partial<AgentOutput<"LexemEnrichment">> = {},
): AgentOutput<"LexemEnrichment"> {
	return {
		emojiDescription: ["🔧"],
		genus: "Maskulinum",
		ipa: "tɛst",
		linguisticUnit: "Lexem",
		nounClass: "Common",
		posLikeKind: "Noun",
		...overrides,
	};
}

describe("dispatchHeaderFormatter", () => {
	it("dispatches Noun with genus to noun formatter (article in output)", () => {
		const result = dispatchHeaderFormatter(
			makeLexemLemmaResult({ posLikeKind: "Noun" }),
			makeNounEnrichment(),
			"German",
		);
		expect(result).toContain("der [[Test]]");
	});

	it("dispatches Verb to common formatter (no article)", () => {
		const result = dispatchHeaderFormatter(
			makeLexemLemmaResult({ posLikeKind: "Verb" }),
			makeVerbEnrichment(),
			"German",
		);
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("dispatches Phrasem to common formatter", () => {
		const result = dispatchHeaderFormatter(
			makePhrasemLemmaResult(),
			{
				emojiDescription: ["🔧"],
				ipa: "tɛst",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
			},
			"German",
		);
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("falls back to common when enrichment is not noun-compatible", () => {
		const result = dispatchHeaderFormatter(
			makeLexemLemmaResult({ posLikeKind: "Noun" }),
			makeVerbEnrichment(),
			"German",
		);
		expect(result).not.toContain("der ");
		expect(result).not.toContain("die ");
		expect(result).not.toContain("das ");
		expect(result).toContain("[[Test]]");
	});

	it("uses fallback noun genus when enrichment genus is missing", () => {
		const result = dispatchHeaderFormatter(
			makeLexemLemmaResult({ posLikeKind: "Noun" }),
			makeNounEnrichment({ genus: undefined }),
			"German",
			"Maskulinum",
		);
		expect(result).toContain("der [[Test]]");
	});

	it("ignores fallback genus for non-noun entries", () => {
		const result = dispatchHeaderFormatter(
			makeLexemLemmaResult({ posLikeKind: "Verb" }),
			makeVerbEnrichment(),
			"German",
			"Femininum",
		);
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("uses precomputedEmojiDescription when available", () => {
		const result = dispatchHeaderFormatter(
			makeLexemLemmaResult({
				posLikeKind: "Verb",
				precomputedEmojiDescription: ["🚀"],
			}),
			{
				emojiDescription: ["🔧"],
				ipa: "tɛst",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
			},
			"German",
		);
		expect(result).toContain("🚀");
		expect(result).not.toContain("🔧");
	});
});
