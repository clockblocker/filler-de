import { describe, expect, it } from "bun:test";
import { dispatchHeaderFormatter } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-dispatch";
import type { LemmaResult } from "../../../../src/commanders/textfresser/commands/lemma/types";

function makeLemmaResult(
	overrides: Partial<LemmaResult> = {},
): LemmaResult {
	return {
		attestation: {
			source: {
				ref: "ref",
				textWithOnlyTargetMarked: "context",
			},
		} as LemmaResult["attestation"],
		disambiguationResult: null,
		emojiDescription: ["🔧"],
		ipa: "tɛst",
		lemma: "Test",
		linguisticUnit: "Lexem",
		surfaceKind: "Lemma",
		...overrides,
	};
}

describe("dispatchHeaderFormatter", () => {
	it("dispatches Noun with genus to noun formatter (article in output)", () => {
		const result = dispatchHeaderFormatter(
			makeLemmaResult({ genus: "Maskulinum", pos: "Noun" }),
			"German",
		);
		expect(result).toContain("der [[Test]]");
	});

	it("dispatches Verb to common formatter (no article)", () => {
		const result = dispatchHeaderFormatter(
			makeLemmaResult({ pos: "Verb" }),
			"German",
		);
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("dispatches Morphem (no POS) to common formatter", () => {
		const result = dispatchHeaderFormatter(
			makeLemmaResult({ linguisticUnit: "Morphem", pos: undefined }),
			"German",
		);
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("falls back to common when Noun has no genus", () => {
		const result = dispatchHeaderFormatter(
			makeLemmaResult({ genus: undefined, pos: "Noun" }),
			"German",
		);
		expect(result).not.toContain("der ");
		expect(result).not.toContain("die ");
		expect(result).not.toContain("das ");
		expect(result).toContain("[[Test]]");
	});

	it("uses precomputedEmojiDescription when available", () => {
		const result = dispatchHeaderFormatter(
			makeLemmaResult({
				emojiDescription: ["🔧"],
				pos: "Verb",
				precomputedEmojiDescription: ["🚀"],
			}),
			"German",
		);
		expect(result).toContain("🚀");
		expect(result).not.toContain("🔧");
	});
});
