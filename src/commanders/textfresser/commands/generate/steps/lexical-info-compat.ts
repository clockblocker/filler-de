import type { LexicalInfo } from "../../../../../lexical-generation";
import type {
	EnrichmentOutput,
	FeaturesOutput,
	InflectionOutput,
	MorphemOutput,
	NounInflectionOutput,
	RelationOutput,
} from "./section-generation-types";

export type LexicalInfoCompatibility = {
	enrichmentOutput: EnrichmentOutput | null;
	featuresOutput: FeaturesOutput | null;
	morphemOutput: MorphemOutput | null;
	nounInflectionOutput: NounInflectionOutput | null;
	otherInflectionOutput: InflectionOutput | null;
	relationOutput: RelationOutput | null;
};

function toEnrichmentOutput(lexicalInfo: LexicalInfo): EnrichmentOutput | null {
	if (lexicalInfo.core.status !== "ready") {
		return null;
	}

	const base = {
		emojiDescription: lexicalInfo.core.value.emojiDescription,
		ipa: lexicalInfo.core.value.ipa,
		...(lexicalInfo.core.value.senseGloss
			? { senseGloss: lexicalInfo.core.value.senseGloss }
			: {}),
	};

	if (
		lexicalInfo.lemma.linguisticUnit === "Lexem" &&
		lexicalInfo.lemma.posLikeKind === "Noun" &&
		lexicalInfo.features.status === "ready" &&
		lexicalInfo.features.value.kind === "noun"
	) {
		return {
			...base,
			genus: lexicalInfo.features.value.genus ?? null,
			nounClass: lexicalInfo.features.value.nounClass ?? null,
		};
	}

	return base;
}

function toFeaturesOutput(lexicalInfo: LexicalInfo): FeaturesOutput | null {
	if (
		lexicalInfo.lemma.linguisticUnit !== "Lexem" ||
		lexicalInfo.features.status !== "ready"
	) {
		return null;
	}

	switch (lexicalInfo.features.value.kind) {
		case "adjective":
			return {
				classification: lexicalInfo.features.value.classification,
				distribution: lexicalInfo.features.value.distribution,
				gradability: lexicalInfo.features.value.gradability,
				valency: lexicalInfo.features.value.valency,
			};
		case "verb":
			return {
				conjugation: lexicalInfo.features.value.conjugation,
				valency: lexicalInfo.features.value.valency,
			};
		case "noun":
		case "tags":
			return {
				tags: lexicalInfo.features.value.tags,
			};
	}
}

function toMorphemOutput(lexicalInfo: LexicalInfo): MorphemOutput | null {
	if (lexicalInfo.morphemicBreakdown.status !== "ready") {
		return null;
	}

	return {
		compounded_from:
			lexicalInfo.morphemicBreakdown.value.compoundedFrom ?? undefined,
		derived_from: lexicalInfo.morphemicBreakdown.value.derivedFrom
			? {
					derivation_type:
						lexicalInfo.morphemicBreakdown.value.derivedFrom
							.derivationType,
					lemma: lexicalInfo.morphemicBreakdown.value.derivedFrom.lemma,
				}
			: undefined,
		morphemes: lexicalInfo.morphemicBreakdown.value.morphemes,
	};
}

function toRelationOutput(lexicalInfo: LexicalInfo): RelationOutput | null {
	if (lexicalInfo.relations.status !== "ready") {
		return null;
	}

	return {
		relations: lexicalInfo.relations.value.relations,
	};
}

function toInflectionOutputs(lexicalInfo: LexicalInfo): {
	nounInflectionOutput: NounInflectionOutput | null;
	otherInflectionOutput: InflectionOutput | null;
} {
	if (
		lexicalInfo.lemma.linguisticUnit !== "Lexem" ||
		lexicalInfo.inflections.status !== "ready"
	) {
		return {
			nounInflectionOutput: null,
			otherInflectionOutput: null,
		};
	}

	if (lexicalInfo.inflections.value.kind === "noun") {
		return {
			nounInflectionOutput: {
				cells: lexicalInfo.inflections.value.cells,
				genus: lexicalInfo.inflections.value.genus,
			},
			otherInflectionOutput: null,
		};
	}

	return {
		nounInflectionOutput: null,
		otherInflectionOutput: {
			rows: lexicalInfo.inflections.value.rows,
		},
	};
}

export function collectLexicalInfoFailures(
	lexicalInfo: LexicalInfo,
	failedSections: string[],
): void {
	if (lexicalInfo.core.status === "error") {
		failedSections.push("Enrichment");
	}
	if (lexicalInfo.features.status === "error") {
		failedSections.push("Features");
	}
	if (lexicalInfo.inflections.status === "error") {
		failedSections.push("Inflection");
	}
	if (lexicalInfo.morphemicBreakdown.status === "error") {
		failedSections.push("Morphem");
	}
	if (lexicalInfo.relations.status === "error") {
		failedSections.push("Relation");
	}
}

export function adaptLexicalInfoToCompatibility(
	lexicalInfo: LexicalInfo,
): LexicalInfoCompatibility {
	const { nounInflectionOutput, otherInflectionOutput } =
		toInflectionOutputs(lexicalInfo);

	return {
		enrichmentOutput: toEnrichmentOutput(lexicalInfo),
		featuresOutput: toFeaturesOutput(lexicalInfo),
		morphemOutput: toMorphemOutput(lexicalInfo),
		nounInflectionOutput,
		otherInflectionOutput,
		relationOutput: toRelationOutput(lexicalInfo),
	};
}
