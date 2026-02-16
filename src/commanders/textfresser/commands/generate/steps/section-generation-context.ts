import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";
import type {
	EnrichmentOutput,
	NounInflectionOutput,
} from "./section-generation-types";

/** V3 sections — the ones generated in the current pipeline. */
export const V3_SECTIONS = new Set<DictSectionKind>([
	DictSectionKind.Morphem,
	DictSectionKind.Relation,
	DictSectionKind.Inflection,
	DictSectionKind.Translation,
	DictSectionKind.Attestation,
	DictSectionKind.Tags,
]);

export function buildSectionQuery(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
) {
	if (lemmaResult.linguisticUnit === "Lexem") {
		const nounClass =
			lemmaResult.posLikeKind === "Noun" &&
			enrichmentOutput.linguisticUnit === "Lexem" &&
			enrichmentOutput.posLikeKind === "Noun"
				? (enrichmentOutput.nounClass ?? undefined)
				: undefined;

		return {
			nounClass,
			pos: lemmaResult.posLikeKind,
			unit: "Lexem" as const,
		};
	}

	return {
		unit: "Phrasem" as const,
	};
}

export function resolveNounInflectionGenus(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
	nounInflectionOutput: NounInflectionOutput | null,
) {
	if (lemmaResult.linguisticUnit !== "Lexem") return undefined;
	if (lemmaResult.posLikeKind !== "Noun") return undefined;
	if (nounInflectionOutput) return nounInflectionOutput.genus;
	if (enrichmentOutput.linguisticUnit !== "Lexem") return undefined;
	if (enrichmentOutput.posLikeKind !== "Noun") return undefined;
	return enrichmentOutput.genus ?? undefined;
}
