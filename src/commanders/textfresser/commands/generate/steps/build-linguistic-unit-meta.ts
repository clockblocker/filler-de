import type { LexicalInfo } from "../../../../../lexical-generation";
import type {
	DeEntity,
	GermanLinguisticUnit,
} from "../../../../../linguistics/de";
import { logger } from "../../../../../utils/logger";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { LemmaResult } from "../../lemma/types";
import { getVerbLexicalFeatures } from "./verb-features";

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
	lexicalInfo: Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }>,
): GermanLinguisticUnit | null {
	if (lemmaResult.surfaceKind === "Lemma") {
		if (lemmaResult.posLikeKind === "Noun") {
			if (
				lexicalInfo.features.status === "ready" &&
				lexicalInfo.features.value.kind === "noun" &&
				lexicalInfo.features.value.genus &&
				lexicalInfo.features.value.nounClass
			) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							genus: lexicalInfo.features.value.genus,
							nounClass: lexicalInfo.features.value.nounClass,
							pos: lemmaResult.posLikeKind,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing noun genus/nounClass for Lexem lemma metadata",
				{ lemmaResult, lexicalInfo },
			);
			return null;
		}

		if (lemmaResult.posLikeKind === "Verb") {
			const verbFeatures = getVerbLexicalFeatures(lexicalInfo);
			if (verbFeatures) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							conjugation: verbFeatures.conjugation,
							pos: "Verb",
							valency: verbFeatures.valency,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing verb features for Lexem lemma metadata",
				{ lemmaResult, lexicalInfo },
			);
			return null;
		}

		if (lemmaResult.posLikeKind === "Adjective") {
			if (
				lexicalInfo.features.status === "ready" &&
				lexicalInfo.features.value.kind === "adjective"
			) {
				return {
					kind: "Lexem",
					surface: {
						features: {
							classification:
								lexicalInfo.features.value.classification,
							distribution:
								lexicalInfo.features.value.distribution,
							gradability: lexicalInfo.features.value.gradability,
							pos: "Adjective",
							valency: lexicalInfo.features.value.valency,
						},
						lemma: lemmaResult.lemma,
						surfaceKind: "Lemma",
					},
				};
			}

			logger.warn(
				"[generateSections] Missing adjective features for Lexem lemma metadata",
				{ lemmaResult, lexicalInfo },
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
	lexicalInfo: Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }>,
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
			(lexicalInfo.core.status === "ready"
				? lexicalInfo.core.value.emojiDescription
				: ["❓"]),
		ipa:
			lexicalInfo.core.status === "ready"
				? lexicalInfo.core.value.ipa
				: "unknown",
		language: "German" as const,
		lemma: lemmaResult.lemma,
		linguisticUnit: "Lexem" as const,
		posLikeKind: lemmaResult.posLikeKind,
		...(lexicalInfo.core.status === "ready" &&
		typeof lexicalInfo.core.value.senseGloss === "string" &&
		lexicalInfo.core.value.senseGloss.length > 0
			? { senseGloss: lexicalInfo.core.value.senseGloss }
			: {}),
		surfaceKind: lemmaResult.surfaceKind,
	};

	if (lemmaResult.surfaceKind === "Lemma") {
		if (
			lemmaResult.posLikeKind === "Noun" &&
			lexicalInfo.features.status === "ready" &&
			lexicalInfo.features.value.kind === "noun" &&
			lexicalInfo.features.value.genus &&
			lexicalInfo.features.value.nounClass
		) {
			return {
				...commonFields,
				features: {
					inflectional: {},
					lexical: {
						genus: lexicalInfo.features.value.genus,
						nounClass: lexicalInfo.features.value.nounClass,
						pos: "Noun",
					},
				},
			} satisfies DeEntity<"Lexem">;
		}

		const verbFeatures = getVerbLexicalFeatures(lexicalInfo);
		if (lemmaResult.posLikeKind === "Verb" && verbFeatures) {
			return {
				...commonFields,
				features: {
					inflectional: {},
					lexical: {
						conjugation: verbFeatures.conjugation,
						pos: "Verb",
						valency: verbFeatures.valency,
					},
				},
			} satisfies DeEntity<"Lexem">;
		}

		if (
			lemmaResult.posLikeKind === "Adjective" &&
			lexicalInfo.features.status === "ready" &&
			lexicalInfo.features.value.kind === "adjective"
		) {
			return {
				...commonFields,
				features: {
					inflectional: {},
					lexical: {
						classification:
							lexicalInfo.features.value.classification,
						distribution: lexicalInfo.features.value.distribution,
						gradability: lexicalInfo.features.value.gradability,
						pos: "Adjective",
						valency: lexicalInfo.features.value.valency,
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
	lexicalInfo: Extract<LexicalInfo, { lemma: { linguisticUnit: "Phrasem" } }>,
): DeEntity<"Phrasem"> {
	const commonFields = {
		emojiDescription:
			lemmaResult.precomputedEmojiDescription ??
			(lexicalInfo.core.status === "ready"
				? lexicalInfo.core.value.emojiDescription
				: ["❓"]),
		ipa:
			lexicalInfo.core.status === "ready"
				? lexicalInfo.core.value.ipa
				: "unknown",
		language: "German" as const,
		lemma: lemmaResult.lemma,
		linguisticUnit: "Phrasem" as const,
		posLikeKind: lemmaResult.posLikeKind,
		...(lexicalInfo.core.status === "ready" &&
		typeof lexicalInfo.core.value.senseGloss === "string" &&
		lexicalInfo.core.value.senseGloss.length > 0
			? { senseGloss: lexicalInfo.core.value.senseGloss }
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
	lexicalInfo: LexicalInfo,
): DeEntity | undefined {
	if (
		lemmaResult.linguisticUnit === "Lexem" &&
		lexicalInfo.lemma.linguisticUnit === "Lexem"
	) {
		return buildLexemEntity(
			lemmaResult,
			lexicalInfo as Extract<
				LexicalInfo,
				{ lemma: { linguisticUnit: "Lexem" } }
			>,
		);
	}

	if (
		lemmaResult.linguisticUnit === "Phrasem" &&
		lexicalInfo.lemma.linguisticUnit === "Phrasem"
	) {
		return buildPhrasemEntity(
			lemmaResult,
			lexicalInfo as Extract<
				LexicalInfo,
				{ lemma: { linguisticUnit: "Phrasem" } }
			>,
		);
	}

	return undefined;
}

export function buildLinguisticUnitMeta(
	entryId: string,
	lemmaResult: LemmaResult,
	lexicalInfo: LexicalInfo,
): GermanLinguisticUnit | undefined {
	if (
		lemmaResult.linguisticUnit === "Lexem" &&
		lexicalInfo.lemma.linguisticUnit === "Lexem"
	) {
		const lexem = buildLexemLinguisticUnit(
			entryId,
			lemmaResult,
			lexicalInfo as Extract<
				LexicalInfo,
				{ lemma: { linguisticUnit: "Lexem" } }
			>,
		);
		return lexem ?? undefined;
	}

	if (
		lemmaResult.linguisticUnit === "Phrasem" &&
		lexicalInfo.lemma.linguisticUnit === "Phrasem"
	) {
		return buildPhrasemLinguisticUnit(entryId, lemmaResult);
	}

	return undefined;
}
