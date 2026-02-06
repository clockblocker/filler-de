import { describe, expect, test } from "bun:test";
import { PARTS_OF_SPEECH } from "../../src/linguistics/common/enums/linguistic-units/lexem/pos";
import {
	getSectionsFor,
	sectionsForLexemPos,
	sectionsForMorphem,
	sectionsForPhrasem,
} from "../../src/linguistics/common/sections/section-config";
import { DictSectionKind } from "../../src/linguistics/common/sections/section-kind";

const CORE = [
	DictSectionKind.Header,
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

describe("getSectionsFor", () => {
	test("returns correct sections for Lexem+Noun", () => {
		expect(getSectionsFor({ pos: "Noun", unit: "Lexem" })).toBe(
			sectionsForLexemPos.Noun,
		);
	});

	test("returns correct sections for Phrasem", () => {
		expect(getSectionsFor({ unit: "Phrasem" })).toBe(sectionsForPhrasem);
	});

	test("returns correct sections for Morphem", () => {
		expect(getSectionsFor({ unit: "Morphem" })).toBe(sectionsForMorphem);
	});
});
