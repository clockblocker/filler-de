import type { POS } from "../enums/linguistic-units/lexem/pos";
import { DictSectionKind } from "./section-kind";

const S = DictSectionKind;

const CORE_SECTIONS = [
	S.Header,
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
	S.Attestation,
	S.Relation,
	S.FreeForm,
];

export const sectionsForMorphem: readonly DictSectionKind[] = [
	S.Header,
	S.Attestation,
	S.FreeForm,
];

type SectionQuery =
	| { unit: "Morphem" | "Phrasem" }
	| { unit: "Lexem"; pos: POS };

export function getSectionsFor(query: {
	unit: "Lexem";
	pos: POS;
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
			return sectionsForLexemPos[query.pos];
		case "Phrasem":
			return sectionsForPhrasem;
		case "Morphem":
			return sectionsForMorphem;
	}
}
