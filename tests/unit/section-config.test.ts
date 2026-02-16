import { describe, expect, test } from "bun:test";
import {
	getSectionsFor,
	sectionsForLexemPos,
	sectionsForMorphem,
	sectionsForPhrasem,
	sectionsForProperNoun,
} from "../../src/commanders/textfresser/targets/de/sections/section-config";

describe("getSectionsFor", () => {
	test("returns correct sections for Lexem+Noun", () => {
		expect(getSectionsFor({ pos: "Noun", unit: "Lexem" })).toBe(
			sectionsForLexemPos.Noun,
		);
	});

	test("returns correct sections for Lexem+Noun (Common) — same as default", () => {
		expect(
			getSectionsFor({ nounClass: "Common", pos: "Noun", unit: "Lexem" }),
		).toBe(sectionsForLexemPos.Noun);
	});

	test("returns correct sections for Lexem+Noun (undefined nounClass) — backward compatible", () => {
		expect(getSectionsFor({ pos: "Noun", unit: "Lexem" })).toBe(
			sectionsForLexemPos.Noun,
		);
	});

	test("returns proper noun sections for Lexem+Noun+Proper", () => {
		expect(
			getSectionsFor({ nounClass: "Proper", pos: "Noun", unit: "Lexem" }),
		).toBe(sectionsForProperNoun);
	});

	test("nounClass is ignored for non-Noun POS", () => {
		// nounClass should only matter for Noun — casting to test edge case
		const query = {
			nounClass: "Proper" as const,
			pos: "Verb" as const,
			unit: "Lexem" as const,
		};
		expect(getSectionsFor(query)).toBe(sectionsForLexemPos.Verb);
	});

	test("returns correct sections for Phrasem", () => {
		expect(getSectionsFor({ unit: "Phrasem" })).toBe(sectionsForPhrasem);
	});

	test("returns correct sections for Morphem", () => {
		expect(getSectionsFor({ unit: "Morphem" })).toBe(sectionsForMorphem);
	});
});
