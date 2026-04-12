import { describe, expect, it } from "bun:test";
import {
	buildSectionQuery,
	resolveNounInflectionGender,
} from "../../../../src/commanders/textfresser/commands/generate/steps/section-generation-context";
import {
	makeLexemeLexicalInfo,
	makeNounInflections,
	makePhrasemeLexicalInfo,
} from "../helpers/native-fixtures";

function makeNounLexicalInfo(params: {
	features?: ReturnType<typeof makeLexemeLexicalInfo>["features"];
	inflections?: ReturnType<typeof makeLexemeLexicalInfo>["inflections"];
} = {}) {
	return makeLexemeLexicalInfo({
		features:
			params.features ??
			({
				status: "ready",
				value: {
					inherentFeatures: {
						gender: "Neut",
					},
				},
			} as const),
		inflections: params.inflections,
		lemma: "Berlin",
		pos: "NOUN",
	});
}

describe("section-generation-context", () => {
	it("builds a lexeme section query from the native selection", () => {
		expect(buildSectionQuery(makeNounLexicalInfo())).toEqual({
			pos: "NOUN",
			unit: "Lexeme",
		});
	});

	it("resolves noun genus from inflections when lexical noun features omit it", () => {
		const genus = resolveNounInflectionGender(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						inherentFeatures: {},
					},
				},
				inflections: {
					status: "ready",
					value: makeNounInflections({ cells: [], gender: "Neut" }),
				},
			}),
		);

		expect(genus).toBe("Neut");
	});

	it("returns undefined when noun features are unavailable and no inflection gender exists", () => {
		const genus = resolveNounInflectionGender(
			makeNounLexicalInfo({
				features: {
					error: {
						kind: "FetchFailed",
						message: "features failed",
					} as never,
					status: "error",
				},
			}),
		);

		expect(genus).toBeUndefined();
	});

	it("returns phrasem section query directly from LexicalInfo", () => {
		expect(buildSectionQuery(makePhrasemeLexicalInfo())).toEqual({
			unit: "Phraseme",
		});
	});
});
