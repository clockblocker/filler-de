import { describe, expect, test } from "bun:test";
import {
	getSectionsFor,
	SECTION_DISPLAY_WEIGHT,
	sectionsForLexemePos,
	sectionsForMorpheme,
	sectionsForPhraseme,
} from "../../src/commanders/textfresser/targets/de/sections/section-config";

describe("getSectionsFor", () => {
	test("returns correct sections for Lexem+Noun", () => {
		expect(getSectionsFor({ pos: "NOUN", unit: "Lexeme" })).toBe(
			sectionsForLexemePos.NOUN,
		);
		expect(sectionsForLexemePos.NOUN).toContain("Morphology");
	});

	test("returns correct sections for Lexeme+NOUN", () => {
		expect(getSectionsFor({ pos: "NOUN", unit: "Lexeme" })).toBe(
			sectionsForLexemePos.NOUN,
		);
	});

	test("routes proper nouns through PROPN", () => {
		expect(getSectionsFor({ pos: "PROPN", unit: "Lexeme" })).toBe(
			sectionsForLexemePos.PROPN,
		);
		expect(sectionsForLexemePos.PROPN).not.toContain("Morphology");
	});

	test("includes morphology for the POS classes that use it", () => {
		for (const [pos, sections] of Object.entries(sectionsForLexemePos)) {
			if (pos === "PROPN" || pos === "PUNCT" || pos === "SYM") {
				expect(sections).not.toContain("Morphology");
				continue;
			}

			expect(sections).toContain("Morphology");
		}
	});

	test("returns verb sections directly by POS", () => {
		expect(getSectionsFor({ pos: "VERB", unit: "Lexeme" })).toBe(
			sectionsForLexemePos.VERB,
		);
	});

	test("returns correct sections for Phrasem", () => {
		expect(getSectionsFor({ unit: "Phraseme" })).toBe(sectionsForPhraseme);
	});

	test("returns correct sections for Morphem", () => {
		expect(getSectionsFor({ unit: "Morpheme" })).toBe(sectionsForMorpheme);
		expect(sectionsForMorpheme).toContain("Morphology");
	});

	test("places morphology right after morphemes in section order", () => {
		expect(SECTION_DISPLAY_WEIGHT.Morphology).toBe(
			SECTION_DISPLAY_WEIGHT.Morpheme + 1,
		);
	});
});
