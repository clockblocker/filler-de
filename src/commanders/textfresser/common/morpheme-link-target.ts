/**
 * Converts LLM morpheme output to MorphemeItem[] with resolved linkTarget.
 *
 * - Prefix (German): linkTarget = "{surf}-prefix-de" (Library canonical basename)
 * - Others: linkTarget stays undefined — formatter falls back to lemma ?? surf
 */

import type { LlmMorpheme } from "../../../prompt-smith/schemas/morphem";
import type { MorphemeItem } from "../domain/morpheme/morpheme-formatter";
import type { TargetLanguage } from "../../../types";

export function resolveMorphemeItems(
	morphemes: LlmMorpheme[],
	targetLang: TargetLanguage,
): MorphemeItem[] {
	return morphemes.map((m): MorphemeItem => {
		const base: MorphemeItem = {
			kind: m.kind,
			surf: m.surf,
			...(m.lemma != null && { lemma: m.lemma }),
			...(m.separability != null && { separability: m.separability }),
		};

		if (m.kind === "Prefix" && targetLang === "German") {
			return { ...base, linkTarget: `${m.surf.toLowerCase()}-prefix-de` };
		}

		return base;
	});
}
