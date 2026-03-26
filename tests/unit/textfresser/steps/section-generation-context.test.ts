import { describe, expect, it } from "bun:test";
import {
	buildSectionQuery,
	resolveNounInflectionGenus,
} from "../../../../src/commanders/textfresser/commands/generate/steps/section-generation-context";
import { getSectionsFor } from "../../../../src/commanders/textfresser/targets/de/sections/section-config";
import type { LexicalInfo } from "../../../../src/lexical-generation";

function makeNounLexicalInfo(
	overrides: Partial<Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }>> = {},
): Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🏙️"],
				ipa: "bɛʁˈliːn",
			},
		},
		features: {
			status: "ready",
			value: {
				genus: "Neutrum",
				kind: "noun",
				nounClass: "Common",
				tags: ["city"],
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Berlin",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
		...overrides,
	};
}

function makePhrasemLexicalInfo(): Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Phrasem" } }
> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["💬"],
				ipa: "ipa",
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
			lemma: "unter vier Augen",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "ready", value: { relations: [] } },
	};
}

describe("section-generation-context", () => {
	it("derives proper-noun section applicability from LexicalInfo features", () => {
		const query = buildSectionQuery(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						genus: undefined,
						kind: "noun",
						nounClass: "Proper",
						tags: ["city"],
					},
				},
			}),
		);

		expect(getSectionsFor(query)).toEqual(
			getSectionsFor({ nounClass: "Proper", pos: "Noun", unit: "Lexem" }),
		);
	});

	it("treats missing nounClass as common-noun applicability", () => {
		const query = buildSectionQuery(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						genus: undefined,
						kind: "noun",
						nounClass: undefined,
						tags: ["city"],
					},
				},
			}),
		);

		expect(getSectionsFor(query)).toEqual(
			getSectionsFor({ nounClass: undefined, pos: "Noun", unit: "Lexem" }),
		);
	});

	it("resolves noun genus from inflections when lexical noun features omit it", () => {
		const genus = resolveNounInflectionGenus(
			makeNounLexicalInfo({
				features: {
					status: "ready",
					value: {
						genus: undefined,
						kind: "noun",
						nounClass: "Common",
						tags: ["city"],
					},
				},
				inflections: {
					status: "ready",
					value: {
						cells: [],
						genus: "Neutrum",
						kind: "noun",
					},
				},
			}),
		);

		expect(genus).toBe("Neutrum");
	});

	it("returns phrasem section query directly from LexicalInfo", () => {
		expect(buildSectionQuery(makePhrasemLexicalInfo())).toEqual({
			unit: "Phrasem",
		});
	});
});
