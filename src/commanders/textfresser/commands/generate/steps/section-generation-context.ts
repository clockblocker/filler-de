import type { LexicalInfo, LexicalGenus } from "../../../../../lexical-generation";
import { DictSectionKind } from "../../../targets/de/sections/section-kind";

/** V3 sections — the ones generated in the current pipeline. */
export const V3_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Morphem,
	DictSectionKind.Morphology,
	DictSectionKind.Relation,
	DictSectionKind.Inflection,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
	DictSectionKind.Tags,
]);

export function buildSectionQuery(lexicalInfo: LexicalInfo) {
	if (lexicalInfo.lemma.linguisticUnit === "Lexem") {
		const nounClass =
			lexicalInfo.lemma.posLikeKind === "Noun" &&
			lexicalInfo.features.status === "ready" &&
			lexicalInfo.features.value.kind === "noun"
				? lexicalInfo.features.value.nounClass
				: undefined;

		return {
			nounClass,
			pos: lexicalInfo.lemma.posLikeKind,
			unit: "Lexem" as const,
		};
	}

	return {
		unit: "Phrasem" as const,
	};
}

export function resolveNounInflectionGenus(
	lexicalInfo: LexicalInfo,
): LexicalGenus | undefined {
	if (
		lexicalInfo.lemma.linguisticUnit !== "Lexem" ||
		lexicalInfo.lemma.posLikeKind !== "Noun"
	) {
		return undefined;
	}

	if (
		lexicalInfo.inflections.status === "ready" &&
		lexicalInfo.inflections.value.kind === "noun"
	) {
		return lexicalInfo.inflections.value.genus;
	}

	if (
		lexicalInfo.features.status === "ready" &&
		lexicalInfo.features.value.kind === "noun"
	) {
		return lexicalInfo.features.value.genus;
	}

	return undefined;
}
