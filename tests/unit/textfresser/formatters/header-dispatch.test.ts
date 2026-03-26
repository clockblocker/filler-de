import { describe, expect, it } from "bun:test";
import { dispatchHeaderFormatter } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-dispatch";
import {
	LexicalGenerationFailureKind,
	type LexicalInfo,
	lexicalGenerationError,
} from "../../../../src/lexical-generation";

function makeVerbLexicalInfo(
	overrides: Partial<Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }>> = {},
): Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🔧"],
				ipa: "tɛst",
			},
		},
		features: {
			status: "ready",
			value: {
				conjugation: "Regular",
				kind: "verb",
				valency: {
					reflexivity: "NonReflexive",
					separability: "None",
				},
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Test",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
		...overrides,
	};
}

function makeNounLexicalInfo(
	overrides: Partial<Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }>> = {},
): Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🔧"],
				ipa: "tɛst",
			},
		},
		features: {
			status: "ready",
			value: {
				genus: "Maskulinum",
				kind: "noun",
				nounClass: "Common",
				tags: [],
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Test",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
		...overrides,
	};
}

function makePhrasemLexicalInfo(
	overrides: Partial<Extract<LexicalInfo, { lemma: { linguisticUnit: "Phrasem" } }>> = {},
): Extract<LexicalInfo, { lemma: { linguisticUnit: "Phrasem" } }> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🔧"],
				ipa: "tɛst",
			},
		},
		features: {
			status: "ready",
			value: {
				kind: "tags",
				tags: [],
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Test",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
		...overrides,
	};
}

describe("dispatchHeaderFormatter", () => {
	it("dispatches Noun with genus to noun formatter (article in output)", () => {
		const result = dispatchHeaderFormatter(makeNounLexicalInfo(), "German");
		expect(result).toContain("der [[Test]]");
	});

	it("dispatches Verb to common formatter (no article)", () => {
		const result = dispatchHeaderFormatter(makeVerbLexicalInfo(), "German");
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("dispatches Phrasem to common formatter", () => {
		const result = dispatchHeaderFormatter(makePhrasemLexicalInfo(), "German");
		expect(result).toBe(
			"🔧 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("falls back to common when noun genus is unavailable", () => {
		const result = dispatchHeaderFormatter(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						genus: undefined,
						kind: "noun",
						nounClass: "Common",
						tags: [],
					},
				},
			}),
			"German",
		);
		expect(result).not.toContain("der ");
		expect(result).not.toContain("die ");
		expect(result).not.toContain("das ");
		expect(result).toContain("[[Test]]");
	});

	it("uses noun inflection genus when noun lexical genus is missing", () => {
		const result = dispatchHeaderFormatter(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						genus: undefined,
						kind: "noun",
						nounClass: "Common",
						tags: [],
					},
				},
				inflections: {
					status: "ready",
					value: {
						cells: [],
						genus: "Maskulinum",
						kind: "noun",
					},
				},
			}),
			"German",
		);
		expect(result).toContain("der [[Test]]");
	});

	it("uses core noun genus when noun features are unavailable", () => {
		const result = dispatchHeaderFormatter(
			makeNounLexicalInfo({
				core: {
					status: "ready",
					value: {
						emojiDescription: ["🔧"],
						ipa: "tɛst",
						nounIdentity: {
							genus: "Maskulinum",
							nounClass: "Common",
						},
					},
				},
				features: {
					error: lexicalGenerationError(
						LexicalGenerationFailureKind.FetchFailed,
						"features failed",
					),
					status: "error",
				},
			}),
			"German",
		);
		expect(result).toContain("der [[Test]]");
	});

	it("falls back to minimal header metadata when lexical core is unavailable", () => {
		const result = dispatchHeaderFormatter(
			makeVerbLexicalInfo({
				core: {
					error: {
						kind: LexicalGenerationFailureKind.FetchFailed,
						message: "nope",
					},
					status: "error",
				},
			}),
			"German",
		);
		expect(result).toContain("❓");
		expect(result).toContain("[unknown]");
	});
});
