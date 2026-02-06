import type { POS } from "../enums/linguistic-units/lexem/pos";
import { cssSuffixFor } from "./section-css-kind";
import { ALL_DICT_SECTION_KINDS, DictSectionKind } from "./section-kind";

const S = DictSectionKind;

const CORE_SECTIONS = [
	S.Header,
	S.Definition,
	S.Translation,
	S.Attestation,
	S.FreeForm,
] as const;

export const sectionsForLexemPos: Record<POS, readonly DictSectionKind[]> = {
	Adjective: [...CORE_SECTIONS, S.Relation, S.Inflection],
	Adverb: [...CORE_SECTIONS, S.Relation],
	Article: [...CORE_SECTIONS, S.Inflection],
	Conjunction: [...CORE_SECTIONS],
	InteractionalUnit: [...CORE_SECTIONS],
	Noun: [...CORE_SECTIONS, S.Relation, S.Morphem, S.Inflection],
	Particle: [...CORE_SECTIONS, S.Relation],
	Preposition: [...CORE_SECTIONS, S.Relation],
	Pronoun: [...CORE_SECTIONS, S.Inflection],
	Verb: [...CORE_SECTIONS, S.Relation, S.Morphem, S.Inflection, S.Deviation],
} satisfies Record<POS, readonly DictSectionKind[]>;

export const sectionsForPhrasem: readonly DictSectionKind[] = [
	S.Header,
	S.Definition,
	S.Translation,
	S.Attestation,
	S.Relation,
	S.FreeForm,
];

export const sectionsForMorphem: readonly DictSectionKind[] = [
	S.Header,
	S.Attestation,
	S.FreeForm,
];

export const sectionsForProperNoun: readonly DictSectionKind[] = [
	...CORE_SECTIONS,
];

/** Display order weight for each section kind (lower = earlier in the note). */
export const SECTION_DISPLAY_WEIGHT: Record<DictSectionKind, number> = {
	[S.Header]: 0,
	[S.Attestation]: 1,
	[S.Relation]: 2,
	[S.Definition]: 3,
	[S.Translation]: 4,
	[S.Morphem]: 5,
	[S.Inflection]: 6,
	[S.Deviation]: 7,
	[S.FreeForm]: 8,
};

/** Weight lookup by CSS suffix — for sorting parsed EntrySection[]. */
const cssSuffixWeight = new Map<string, number>(
	ALL_DICT_SECTION_KINDS.map((kind) => [
		cssSuffixFor[kind],
		SECTION_DISPLAY_WEIGHT[kind],
	]),
);

/** Compare two sections by display weight. Unknown kinds sort to the end. */
export function compareSectionsByWeight(
	a: { kind: string },
	b: { kind: string },
): number {
	return (
		(cssSuffixWeight.get(a.kind) ?? 99) -
		(cssSuffixWeight.get(b.kind) ?? 99)
	);
}

type NounClass = "Common" | "Proper";

type SectionQuery =
	| { unit: "Morphem" | "Phrasem" }
	| { unit: "Lexem"; pos: POS; nounClass?: NounClass };

export function getSectionsFor(query: {
	unit: "Lexem";
	pos: POS;
	nounClass?: NounClass;
}): readonly DictSectionKind[];
export function getSectionsFor(query: {
	unit: "Morphem" | "Phrasem";
}): readonly DictSectionKind[];
export function getSectionsFor(query: SectionQuery): readonly DictSectionKind[];

export function getSectionsFor(
	query: SectionQuery,
): readonly DictSectionKind[] {
	switch (query.unit) {
		case "Lexem":
			if (query.pos === "Noun" && query.nounClass === "Proper") {
				return sectionsForProperNoun;
			}
			return sectionsForLexemPos[query.pos];
		case "Phrasem":
			return sectionsForPhrasem;
		case "Morphem":
			return sectionsForMorphem;
	}
}
