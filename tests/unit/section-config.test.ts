import { describe, expect, test } from "bun:test";
import { PARTS_OF_SPEECH } from "../../src/linguistics/common/enums/linguistic-units/lexem/pos";
import {
	getSectionsFor,
	sectionsForLexemPos,
	sectionsForMorphem,
	sectionsForPhrasem,
	sectionsForProperNoun,
} from "../../src/linguistics/common/sections/section-config";
import { DictSectionKind } from "../../src/linguistics/common/sections/section-kind";

const CORE = [
	DictSectionKind.Header,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
	DictSectionKind.FreeForm,
];

describe("sectionsForLexemPos", () => {
	test("every POS has a non-empty section list", () => {
		for (const pos of PARTS_OF_SPEECH) {
			const sections = sectionsForLexemPos[pos];
			expect(sections.length).toBeGreaterThan(0);
		}
	});

	test("every POS list starts with core sections", () => {
		for (const pos of PARTS_OF_SPEECH) {
			const sections = sectionsForLexemPos[pos];
			for (const core of CORE) {
				expect(sections).toContain(core);
			}
		}
	});

	test("Noun has Relation, Morphem, Inflection", () => {
		const sections = sectionsForLexemPos.Noun;
		expect(sections).toContain(DictSectionKind.Relation);
		expect(sections).toContain(DictSectionKind.Morphem);
		expect(sections).toContain(DictSectionKind.Inflection);
	});

	test("Verb has Deviation", () => {
		expect(sectionsForLexemPos.Verb).toContain(DictSectionKind.Deviation);
	});

	test("Conjunction has only core sections", () => {
		expect(sectionsForLexemPos.Conjunction).toEqual(CORE);
	});
});

describe("sectionsForPhrasem", () => {
	test("contains Header, Attestation, Relation, FreeForm", () => {
		expect(sectionsForPhrasem).toContain(DictSectionKind.Header);
		expect(sectionsForPhrasem).toContain(DictSectionKind.Attestation);
		expect(sectionsForPhrasem).toContain(DictSectionKind.Relation);
		expect(sectionsForPhrasem).toContain(DictSectionKind.FreeForm);
	});
});

describe("sectionsForMorphem", () => {
	test("contains Header, Attestation, FreeForm", () => {
		expect(sectionsForMorphem).toEqual([
			DictSectionKind.Header,
			DictSectionKind.Attestation,
			DictSectionKind.FreeForm,
		]);
	});
});

describe("sectionsForProperNoun", () => {
	test("contains only core sections (no Inflection, Morphem, Relation)", () => {
		expect(sectionsForProperNoun).toContain(DictSectionKind.Header);
		expect(sectionsForProperNoun).toContain(DictSectionKind.Translation);
		expect(sectionsForProperNoun).toContain(DictSectionKind.Attestation);
		expect(sectionsForProperNoun).toContain(DictSectionKind.FreeForm);
		expect(sectionsForProperNoun).not.toContain(DictSectionKind.Inflection);
		expect(sectionsForProperNoun).not.toContain(DictSectionKind.Morphem);
		expect(sectionsForProperNoun).not.toContain(DictSectionKind.Relation);
	});
});

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
