import { buildGermanVerbEntryIdentity } from "../../../../../linguistics/de";
import type {
	FeaturesOutput,
	VerbFeaturesOutput,
} from "./section-generation-types";

function normalizeTagPart(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function isVerbFeaturesOutput(
	output: FeaturesOutput | null,
): output is VerbFeaturesOutput {
	return output !== null && "conjugation" in output && "valency" in output;
}

export function buildVerbFeatureTags(output: VerbFeaturesOutput): string[] {
	const tags = [
		`conjugation-${normalizeTagPart(output.conjugation)}`,
		`separability-${normalizeTagPart(output.valency.separability)}`,
		`reflexivity-${normalizeTagPart(output.valency.reflexivity)}`,
	];

	if (output.valency.governedPreposition) {
		tags.push(
			`prep-${normalizeTagPart(output.valency.governedPreposition)}`,
		);
	}

	return tags;
}

export function buildVerbEntryIdentityFromFeatures(
	output: VerbFeaturesOutput,
): string {
	return buildGermanVerbEntryIdentity({
		conjugation: output.conjugation,
		valency: output.valency,
	});
}
