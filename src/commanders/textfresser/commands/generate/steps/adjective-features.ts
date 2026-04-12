import type { InherentFeatures } from "@textfresser/lexical-generation";
import { buildInherentFeatureTags } from "./inherent-feature-tags";

export function buildAdjectiveFeatureTags(
	output: InherentFeatures,
): string[] {
	return buildInherentFeatureTags(output);
}
