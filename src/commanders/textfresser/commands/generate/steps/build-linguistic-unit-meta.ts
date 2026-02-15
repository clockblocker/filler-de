import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import type { GermanLinguisticUnit } from "../../../../../linguistics/de";
import { logger } from "../../../../../utils/logger";
import type { LemmaResult } from "../../lemma/types";
import type {
	EnrichmentOutput,
	LexemEnrichmentOutput,
} from "./section-generation-types";

function buildLemmaRefId(entryId: string): string {
	const parsed = dictEntryIdHelper.parse(entryId);
	if (!parsed || parsed.surfaceKind === "Lemma") return entryId;

	if (parsed.unitKind === "Lexem" && parsed.pos) {
		return dictEntryIdHelper.build({
			index: parsed.index,
			pos: parsed.pos,
			surfaceKind: "Lemma",
			unitKind: "Lexem",
		});
	}

	return dictEntryIdHelper.build({
		index: parsed.index,
		surfaceKind: "Lemma",
		unitKind: parsed.unitKind,
	});
}

function buildLexemLinguisticUnit(
	entryId: string,
	lemmaResult: Extract<LemmaResult, { linguisticUnit: "Lexem" }>,
	enrichmentOutput: LexemEnrichmentOutput,
): GermanLinguisticUnit | null {
	if (lemmaResult.surfaceKind === "Lemma") {
		if (lemmaResult.posLikeKind === "Noun") {
			if (
				enrichmentOutput.posLikeKind === "Noun" &&
				enrichmentOutput.genus &&
				enrichmentOutput.nounClass
			) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							genus: enrichmentOutput.genus,
							nounClass: enrichmentOutput.nounClass,
							pos: lemmaResult.posLikeKind,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing noun genus/nounClass for Lexem lemma metadata",
				{ enrichmentOutput, lemmaResult },
			);
			return null;
		}

		return {
			kind: "Lexem",
			surface: {
				features: { pos: lemmaResult.posLikeKind },
				lemma: lemmaResult.lemma,
				surfaceKind: "Lemma",
			},
		};
	}

	return {
		kind: "Lexem",
		surface: {
			features: { pos: lemmaResult.posLikeKind },
			lemma: lemmaResult.lemma,
			lemmaRef: buildLemmaRefId(entryId),
			surface: lemmaResult.attestation.target.surface,
			surfaceKind: lemmaResult.surfaceKind,
		},
	};
}

function buildPhrasemLinguisticUnit(
	entryId: string,
	lemmaResult: Extract<LemmaResult, { linguisticUnit: "Phrasem" }>,
): GermanLinguisticUnit {
	const phrasemeFeatures = { phrasemeKind: lemmaResult.posLikeKind };

	if (lemmaResult.surfaceKind === "Lemma") {
		return {
			kind: "Phrasem",
			surface: {
				features: phrasemeFeatures,
				lemma: lemmaResult.lemma,
				surfaceKind: "Lemma",
			},
		};
	}

	return {
		kind: "Phrasem",
		surface: {
			features: phrasemeFeatures,
			lemma: lemmaResult.lemma,
			lemmaRef: buildLemmaRefId(entryId),
			surface: lemmaResult.attestation.target.surface,
			surfaceKind: lemmaResult.surfaceKind,
		},
	};
}

export function buildLinguisticUnitMeta(
	entryId: string,
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
): GermanLinguisticUnit | undefined {
	if (
		lemmaResult.linguisticUnit === "Lexem" &&
		enrichmentOutput.linguisticUnit === "Lexem"
	) {
		const lexem = buildLexemLinguisticUnit(
			entryId,
			lemmaResult,
			enrichmentOutput,
		);
		return lexem ?? undefined;
	}

	if (
		lemmaResult.linguisticUnit === "Phrasem" &&
		enrichmentOutput.linguisticUnit === "Phrasem"
	) {
		return buildPhrasemLinguisticUnit(entryId, lemmaResult);
	}

	logger.warn(
		"[generateSections] Enrichment output linguisticUnit mismatched lemma result",
		{ enrichmentUnit: enrichmentOutput.linguisticUnit, lemmaResult },
	);
	return undefined;
}
