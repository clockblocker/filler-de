import type { LexemFeatures } from "@textfresser/lexical-generation";
import { normalizeTagPart } from "./tag-normalization";

type AdjectiveFeatures = Extract<LexemFeatures, { kind: "adjective" }>;

export function buildAdjectiveFeatureTags(output: AdjectiveFeatures): string[] {
	const tags = [
		`classification-${normalizeTagPart(output.classification)}`,
		`gradability-${normalizeTagPart(output.gradability)}`,
		`distribution-${normalizeTagPart(output.distribution)}`,
		`valency-${normalizeTagPart(output.valency.governedPattern)}`,
	];

	if (output.valency.governedPreposition) {
		tags.push(
			`prep-${normalizeTagPart(output.valency.governedPreposition)}`,
		);
	}

	return tags;
}
