import { describe, expect, it } from "bun:test";
import {
	buildLocalizedInflectionTagsFromCells,
	buildNounInflectionPropagationHeader,
	isNounInflectionPropagationHeaderForLemma,
	mergeLocalizedInflectionTags,
} from "../../../../../src/commanders/textfresser/commands/generate/section-formatters/common/inflection-propagation-helper";
import type { NounInflectionCell } from "../../../../../src/linguistics/de/lexem/noun";

describe("inflectionPropagationHelper", () => {
	it("builds deterministic deduped tag order from cells", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Accusative",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "der",
				case: "Genitive",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "das",
				case: "Nominative",
				form: "Kraftwerk",
				number: "Singular",
			},
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
		];

		const tags = buildLocalizedInflectionTagsFromCells(cells, "German");
		expect(tags).toEqual([
			"#Nominativ/Singular",
			"#Nominativ/Plural",
			"#Akkusativ/Plural",
			"#Genitiv/Plural",
		]);
	});

	it("merges existing and new tags with localization normalization", () => {
		const merged = mergeLocalizedInflectionTags(
			"#Nominative/Plural #Nominativ/Plural #Dativ/Plural",
			["#Akkusativ/Plural"],
			"German",
		);

		expect(merged).toBe(
			"#Nominativ/Plural #Akkusativ/Plural #Dativ/Plural",
		);
	});

	it("builds fallback and genus-specific noun inflection headers", () => {
		expect(
			buildNounInflectionPropagationHeader(
				"Staub",
				undefined,
				"German",
			),
		).toBe("#Inflection/Noun for: [[Staub]]");
		expect(
			buildNounInflectionPropagationHeader(
				"Staub",
				"Maskulinum",
				"German",
			),
		).toBe("#Inflection/Noun/Maskulin for: [[Staub]]");
	});

	it("matches noun inflection headers for a lemma with and without genus", () => {
		expect(
			isNounInflectionPropagationHeaderForLemma(
				"#Inflection/Noun for: [[Staub]]",
				"Staub",
			),
		).toBe(true);
		expect(
			isNounInflectionPropagationHeaderForLemma(
				"#Inflection/Noun/Maskulin for: [[Staub]]",
				"Staub",
			),
		).toBe(true);
		expect(
			isNounInflectionPropagationHeaderForLemma(
				"#Inflection/Noun/Feminin for: [[Staub]]",
				"Staub",
			),
		).toBe(true);
		expect(
			isNounInflectionPropagationHeaderForLemma(
				"#Inflection/Noun/Maskulin for: [[Schaum]]",
				"Staub",
			),
		).toBe(false);
	});
});
