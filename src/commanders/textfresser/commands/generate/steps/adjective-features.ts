import type {
	AdjectiveFeaturesOutput,
	FeaturesOutput,
} from "./section-generation-types";
import { normalizeTagPart } from "./tag-normalization";

export function isAdjectiveFeaturesOutput(
	output: FeaturesOutput | null,
): output is AdjectiveFeaturesOutput {
	return (
		output !== null &&
		"classification" in output &&
		"distribution" in output &&
		"gradability" in output &&
		"valency" in output
	);
}

export function buildAdjectiveFeatureTags(
	output: AdjectiveFeaturesOutput,
): string[] {
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
