import { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";
import type {
	EnrichmentOutput,
	NounInflectionOutput,
} from "./section-generation-types";

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

export function buildSectionQuery(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
) {
	if (lemmaResult.linguisticUnit === "Lexem") {
		// NounEnrichment is strict and the only enrichment shape that carries nounClass.
		const nounClass =
			lemmaResult.posLikeKind === "Noun" &&
			"nounClass" in enrichmentOutput
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
	// NounEnrichment is strict and the only enrichment shape that carries genus.
	if (!("genus" in enrichmentOutput)) return undefined;
	return enrichmentOutput.genus ?? undefined;
}
