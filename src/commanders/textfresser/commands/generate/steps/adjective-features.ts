import type { InherentFeatures } from "../../../../../deprecated-linguistic-enums";
import { buildInherentFeatureTags } from "./inherent-feature-tags";

export function buildAdjectiveFeatureTags(
	output: InherentFeatures,
): string[] {
	return buildInherentFeatureTags(output);
}
