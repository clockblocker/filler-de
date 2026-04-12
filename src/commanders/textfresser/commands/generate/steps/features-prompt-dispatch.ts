import {
	PromptKind,
	type PromptKind as PromptKindType,
} from "@textfresser/lexical-generation";
import type { POS as LexicalPos } from "../../../domain/note-linguistic-policy";

export type FeaturesPromptKind = Extract<PromptKindType, `Features${string}`>;

const FEATURES_PROMPT_KIND_BY_POS: Record<LexicalPos, FeaturesPromptKind> = {
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
	pos: LexicalPos,
): FeaturesPromptKind {
	return FEATURES_PROMPT_KIND_BY_POS[pos];
}

export function buildFeatureTagPath(pos: LexicalPos, tags: string[]): string {
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
