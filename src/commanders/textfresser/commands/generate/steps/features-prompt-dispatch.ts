import type { DeLexemPos } from "../../../../../linguistics/de";
import {
	PromptKind,
	type PromptKind as PromptKindType,
} from "../../../../../prompt-smith/codegen/consts";

export type FeaturesPromptKind = Extract<PromptKindType, `Features${string}`>;

const FEATURES_PROMPT_KIND_BY_POS: Record<DeLexemPos, FeaturesPromptKind> = {
	Adjective: PromptKind.FeaturesAdjective,
	Adverb: PromptKind.FeaturesAdverb,
	Article: PromptKind.FeaturesArticle,
	Conjunction: PromptKind.FeaturesConjunction,
	InteractionalUnit: PromptKind.FeaturesInteractionalUnit,
	Noun: PromptKind.FeaturesNoun,
	Particle: PromptKind.FeaturesParticle,
	Preposition: PromptKind.FeaturesPreposition,
	Pronoun: PromptKind.FeaturesPronoun,
	Verb: PromptKind.FeaturesVerb,
};

export function getFeaturesPromptKindForPos(
	pos: DeLexemPos,
): FeaturesPromptKind {
	return FEATURES_PROMPT_KIND_BY_POS[pos];
}

export function buildFeatureTagPath(pos: DeLexemPos, tags: string[]): string {
	const parts = [
		pos.toLowerCase(),
		...tags
			.map((tag) => tag.trim().toLowerCase())
			.filter((tag) => tag.length > 0),
	];
	const seen = new Set<string>();
	const dedupedParts: string[] = [];

	for (const part of parts) {
		if (seen.has(part)) continue;
		seen.add(part);
		dedupedParts.push(part);
	}

	return `#${dedupedParts.join("/")}`;
}
