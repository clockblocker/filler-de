import type {
	DeEntity,
	GermanLinguisticUnit,
} from "../../../../../linguistics/de";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { LemmaResult } from "../../lemma/types";
import { isAdjectiveFeaturesOutput } from "./adjective-features";
import type {
	EnrichmentOutput,
	FeaturesOutput,
	LexemEnrichmentOutput,
} from "./section-generation-types";
import { isVerbFeaturesOutput } from "./verb-features";

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
	featuresOutput: FeaturesOutput | null,
): GermanLinguisticUnit | null {
	if (lemmaResult.surfaceKind === "Lemma") {
		if (lemmaResult.posLikeKind === "Noun") {
			// NounEnrichment is strict and the only enrichment shape with genus/nounClass.
			if (
				"genus" in enrichmentOutput &&
				"nounClass" in enrichmentOutput &&
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

		if (lemmaResult.posLikeKind === "Verb") {
			if (isVerbFeaturesOutput(featuresOutput)) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							conjugation: featuresOutput.conjugation,
							pos: "Verb",
							valency: featuresOutput.valency,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing verb features for Lexem lemma metadata",
				{ enrichmentOutput, featuresOutput, lemmaResult },
			);
			return null;
		}

		if (lemmaResult.posLikeKind === "Adjective") {
			if (isAdjectiveFeaturesOutput(featuresOutput)) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							classification: featuresOutput.classification,
							distribution: featuresOutput.distribution,
							gradability: featuresOutput.gradability,
							pos: "Adjective",
							valency: featuresOutput.valency,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing adjective features for Lexem lemma metadata",
				{ enrichmentOutput, featuresOutput, lemmaResult },
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

function buildLexemEntity(
	lemmaResult: Extract<LemmaResult, { linguisticUnit: "Lexem" }>,
	enrichmentOutput: LexemEnrichmentOutput,
	featuresOutput: FeaturesOutput | null,
): DeEntity<"Lexem"> {
	const buildPosOnlyLexicalFeature = (
		pos: Extract<LemmaResult, { linguisticUnit: "Lexem" }>["posLikeKind"],
	) => {
		switch (pos) {
			case "Noun":
				return { pos: "Noun" as const };
			case "Pronoun":
				return { pos: "Pronoun" as const };
			case "Article":
				return { pos: "Article" as const };
			case "Adjective":
				return { pos: "Adjective" as const };
			case "Verb":
				return { pos: "Verb" as const };
			case "Preposition":
				return { pos: "Preposition" as const };
			case "Adverb":
				return { pos: "Adverb" as const };
			case "Particle":
				return { pos: "Particle" as const };
			case "Conjunction":
				return { pos: "Conjunction" as const };
			case "InteractionalUnit":
				return { pos: "InteractionalUnit" as const };
		}
	};

	const commonFields = {
		emojiDescription:
			lemmaResult.precomputedEmojiDescription ??
			enrichmentOutput.emojiDescription,
		ipa: enrichmentOutput.ipa,
		language: "German" as const,
		lemma: lemmaResult.lemma,
		linguisticUnit: "Lexem" as const,
		posLikeKind: lemmaResult.posLikeKind,
		...(typeof enrichmentOutput.senseGloss === "string" &&
		enrichmentOutput.senseGloss.length > 0
			? { senseGloss: enrichmentOutput.senseGloss }
			: {}),
		surfaceKind: lemmaResult.surfaceKind,
	};

	if (lemmaResult.surfaceKind === "Lemma") {
		if (
			lemmaResult.posLikeKind === "Noun" &&
			"genus" in enrichmentOutput &&
			"nounClass" in enrichmentOutput &&
			enrichmentOutput.genus &&
			enrichmentOutput.nounClass
		) {
			return {
				...commonFields,
				features: {
					inflectional: {},
					lexical: {
						genus: enrichmentOutput.genus,
						nounClass: enrichmentOutput.nounClass,
						pos: "Noun",
					},
				},
			} satisfies DeEntity<"Lexem">;
		}

		if (
			lemmaResult.posLikeKind === "Verb" &&
			isVerbFeaturesOutput(featuresOutput)
		) {
			return {
				...commonFields,
				features: {
					inflectional: {},
					lexical: {
						conjugation: featuresOutput.conjugation,
						pos: "Verb",
						valency: featuresOutput.valency,
					},
				},
			} satisfies DeEntity<"Lexem">;
		}

		if (
			lemmaResult.posLikeKind === "Adjective" &&
			isAdjectiveFeaturesOutput(featuresOutput)
		) {
			return {
				...commonFields,
				features: {
					inflectional: {},
					lexical: {
						classification: featuresOutput.classification,
						distribution: featuresOutput.distribution,
						gradability: featuresOutput.gradability,
						pos: "Adjective",
						valency: featuresOutput.valency,
					},
				},
			} satisfies DeEntity<"Lexem">;
		}

		return {
			...commonFields,
			features: {
				inflectional: {},
				lexical: buildPosOnlyLexicalFeature(lemmaResult.posLikeKind),
			},
		} satisfies DeEntity<"Lexem">;
	}

	return {
		...commonFields,
		features: {
			inflectional: {},
			lexical: buildPosOnlyLexicalFeature(lemmaResult.posLikeKind),
		},
		surface: lemmaResult.attestation.target.surface,
	} satisfies DeEntity<"Lexem">;
}

function buildPhrasemEntity(
	lemmaResult: Extract<LemmaResult, { linguisticUnit: "Phrasem" }>,
	enrichmentOutput: EnrichmentOutput,
): DeEntity<"Phrasem"> {
	const commonFields = {
		emojiDescription:
			lemmaResult.precomputedEmojiDescription ??
			enrichmentOutput.emojiDescription,
		ipa: enrichmentOutput.ipa,
		language: "German" as const,
		lemma: lemmaResult.lemma,
		linguisticUnit: "Phrasem" as const,
		posLikeKind: lemmaResult.posLikeKind,
		...(typeof enrichmentOutput.senseGloss === "string" &&
		enrichmentOutput.senseGloss.length > 0
			? { senseGloss: enrichmentOutput.senseGloss }
			: {}),
		surfaceKind: lemmaResult.surfaceKind,
	};

	if (lemmaResult.surfaceKind === "Lemma") {
		return {
			...commonFields,
			features: {
				inflectional: {},
				lexical: { phrasemeKind: lemmaResult.posLikeKind },
			},
		} satisfies DeEntity<"Phrasem">;
	}

	return {
		...commonFields,
		features: {
			inflectional: {},
			lexical: { phrasemeKind: lemmaResult.posLikeKind },
		},
		surface: lemmaResult.attestation.target.surface,
	} satisfies DeEntity<"Phrasem">;
}

export function buildEntityMeta(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
	featuresOutput: FeaturesOutput | null,
): DeEntity | undefined {
	if (lemmaResult.linguisticUnit === "Lexem") {
		return buildLexemEntity(lemmaResult, enrichmentOutput, featuresOutput);
	}

	return buildPhrasemEntity(lemmaResult, enrichmentOutput);
}

export function buildLinguisticUnitMeta(
	entryId: string,
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
	featuresOutput: FeaturesOutput | null,
): GermanLinguisticUnit | undefined {
	if (lemmaResult.linguisticUnit === "Lexem") {
		const lexem = buildLexemLinguisticUnit(
			entryId,
			lemmaResult,
			enrichmentOutput,
			featuresOutput,
		);
		return lexem ?? undefined;
	}

	return buildPhrasemLinguisticUnit(entryId, lemmaResult);
}
