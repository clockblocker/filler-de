import type { InherentFeatures } from "../../../../../deprecated-linguistic-enums";
import { normalizeTagPart } from "./tag-normalization";

export function buildInherentFeatureTags(
	inherentFeatures: InherentFeatures,
): string[] {
	return Object.entries(inherentFeatures)
		.flatMap(([key, value]) => {
			if (value === undefined) {
				return [];
			}
			if (typeof value === "boolean") {
				return [`${normalizeTagPart(key)}-${value ? "yes" : "no"}`];
			}

			return [`${normalizeTagPart(key)}-${normalizeTagPart(String(value))}`];
		})
		.sort();
}
