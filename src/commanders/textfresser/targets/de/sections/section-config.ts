import type { POS } from "../../../domain/note-linguistic-policy";
import { cssSuffixFor } from "./section-css-kind";
import { ALL_DICT_SECTION_KINDS, DictSectionKind } from "./section-kind";

const S = DictSectionKind;

const CORE_SECTIONS = [
	S.Header,
	S.Tags,
	S.Translation,
	S.Attestation,
	S.FreeForm,
] as const;

export const sectionsForLexemePos: Record<POS, readonly DictSectionKind[]> = {
	ADJ: [...CORE_SECTIONS, S.Relation, S.Morphology, S.Inflection],
	ADP: [...CORE_SECTIONS, S.Relation, S.Morphology],
	ADV: [...CORE_SECTIONS, S.Relation, S.Morphology],
	AUX: [...CORE_SECTIONS, S.Relation, S.Morphology, S.Inflection],
	CCONJ: [...CORE_SECTIONS, S.Morphology],
	DET: [...CORE_SECTIONS, S.Morphology, S.Inflection],
	INTJ: [...CORE_SECTIONS, S.Morphology],
	NOUN: [...CORE_SECTIONS, S.Relation, S.Morpheme, S.Morphology, S.Inflection],
	NUM: [...CORE_SECTIONS, S.Relation, S.Morphology, S.Inflection],
	PART: [...CORE_SECTIONS, S.Relation, S.Morphology],
	PRON: [...CORE_SECTIONS, S.Morphology, S.Inflection],
	PROPN: [...CORE_SECTIONS],
	PUNCT: [...CORE_SECTIONS],
	SCONJ: [...CORE_SECTIONS, S.Morphology],
	SYM: [...CORE_SECTIONS],
	VERB: [
		...CORE_SECTIONS,
		S.Relation,
		S.Morpheme,
		S.Morphology,
		S.Inflection,
		S.Deviation,
	],
	X: [...CORE_SECTIONS, S.Morphology],
} satisfies Record<POS, readonly DictSectionKind[]>;

export const sectionsForPhraseme: readonly DictSectionKind[] = [
	S.Header,
	S.Translation,
	S.Attestation,
	S.Relation,
	S.FreeForm,
];

export const sectionsForMorpheme: readonly DictSectionKind[] = [
	S.Header,
	S.Tags,
	S.Morphology,
	S.Attestation,
	S.FreeForm,
];

export const SECTION_DISPLAY_WEIGHT: Record<DictSectionKind, number> = {
	[S.Header]: 0,
	[S.Attestation]: 1,
	[S.Relation]: 2,
	[S.Translation]: 3,
	[S.Morpheme]: 4,
	[S.Morphology]: 5,
	[S.Tags]: 6,
	[S.Inflection]: 7,
	[S.Deviation]: 8,
	[S.FreeForm]: 9,
};

const cssSuffixWeight = new Map<string, number>(
	ALL_DICT_SECTION_KINDS.map((kind) => [
		cssSuffixFor[kind],
		SECTION_DISPLAY_WEIGHT[kind],
	]),
);

export function compareSectionsByWeight(
	a: { kind: string },
	b: { kind: string },
): number {
	return (
		(cssSuffixWeight.get(a.kind) ?? 99) -
		(cssSuffixWeight.get(b.kind) ?? 99)
	);
}

type SectionQuery =
	| { unit: "Morpheme" | "Phraseme" }
	| { unit: "Lexeme"; pos: POS };

export function getSectionsFor(query: SectionQuery): readonly DictSectionKind[] {
	switch (query.unit) {
		case "Lexeme":
			return sectionsForLexemePos[query.pos];
		case "Phraseme":
			return sectionsForPhraseme;
		case "Morpheme":
			return sectionsForMorpheme;
	}

	throw new Error(`Unhandled section query unit: ${JSON.stringify(query)}`);
}
