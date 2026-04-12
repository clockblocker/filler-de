import { describe, expect, it } from "bun:test";
import { dispatchHeaderFormatter } from "../../../../src/commanders/textfresser/commands/generate/section-formatters/header-dispatch";
import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "@textfresser/lexical-generation";
import {
	makeLexemeLexicalInfo,
	makeNounInflections,
	makePhrasemeLexicalInfo,
} from "../helpers/native-fixtures";

function makeVerbLexicalInfo(params: {
	core?: ReturnType<typeof makeLexemeLexicalInfo>["core"];
} = {}) {
	return makeLexemeLexicalInfo({
		core: params.core,
		features: {
			status: "ready",
			value: {
				inherentFeatures: {
					reflex: false,
					separable: false,
				},
			},
		},
		lemma: "Test",
		pos: "VERB",
	});
}

function makeNounLexicalInfo(params: {
	features?: ReturnType<typeof makeLexemeLexicalInfo>["features"];
	inflections?: ReturnType<typeof makeLexemeLexicalInfo>["inflections"];
	core?: ReturnType<typeof makeLexemeLexicalInfo>["core"];
} = {}) {
	return makeLexemeLexicalInfo({
		core: params.core,
		features:
			params.features ??
			({
				status: "ready",
				value: {
					inherentFeatures: {
						gender: "Masc",
					},
				},
			} as const),
		inflections: params.inflections,
		lemma: "Test",
		pos: "NOUN",
	});
}

function makePhrasemLexicalInfo() {
	return makePhrasemeLexicalInfo({
		lemma: "Test",
	});
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
			"💬 [[Test]], [tɛst](https://youglish.com/pronounce/Test/german)",
		);
	});

	it("falls back to common when noun genus is unavailable", () => {
		const result = dispatchHeaderFormatter(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						inherentFeatures: {},
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
						inherentFeatures: {},
					},
				},
				inflections: {
					status: "ready",
					value: makeNounInflections({ cells: [], gender: "Masc" }),
				},
			}),
			"German",
		);
		expect(result).toContain("der [[Test]]");
	});

	it("uses noun inflection gender when noun features are unavailable", () => {
		const result = dispatchHeaderFormatter(
			makeNounLexicalInfo({
				features: {
					error: lexicalGenerationError(
						LexicalGenerationFailureKind.FetchFailed,
						"features failed",
					),
					status: "error",
				},
				inflections: {
					status: "ready",
					value: makeNounInflections({ cells: [], gender: "Masc" }),
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
