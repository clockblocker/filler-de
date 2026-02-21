/**
 * Converts LLM morpheme output to MorphemeItem[] with resolved linkTarget.
 *
 * - Prefix (German): linkTarget = "{surf}-prefix-de" (Library canonical basename)
 * - Others: linkTarget stays undefined — formatter falls back to lemma ?? surf
 */

import type { LlmMorpheme } from "../../../prompt-smith/schemas/morphem";
import { wikilinkHelper } from "../../../stateless-helpers/wikilink";
import type { TargetLanguage } from "../../../types";
import type { MorphemeItem } from "../domain/morpheme/morpheme-formatter";

const PREFIX_TARGET_SUFFIX = "-prefix-de";

function stripAnchor(value: string): string {
	const anchorIndex = value.indexOf("#");
	return anchorIndex >= 0 ? value.slice(0, anchorIndex) : value;
}

function stripPrefixTargetSuffix(value: string): string {
	const lower = value.toLowerCase();
	if (!lower.endsWith(PREFIX_TARGET_SUFFIX)) {
		return value;
	}
	return value.slice(0, -PREFIX_TARGET_SUFFIX.length);
}

function buildPrefixTarget(value: string): string {
	const lower = value.toLowerCase();
	return lower.endsWith(PREFIX_TARGET_SUFFIX)
		? lower
		: `${lower}${PREFIX_TARGET_SUFFIX}`;
}

export function resolveMorphemeItems(
	morphemes: LlmMorpheme[],
	targetLang: TargetLanguage,
): MorphemeItem[] {
	return morphemes.map((m): MorphemeItem => {
		const normalizedRawSurf = stripAnchor(
			wikilinkHelper.normalizeLinkTarget(m.surf),
		);
		const normalizedSurf =
			m.kind === "Prefix" && targetLang === "German"
				? stripPrefixTargetSuffix(normalizedRawSurf)
				: normalizedRawSurf;
		const normalizedLemma =
			typeof m.lemma === "string"
				? stripAnchor(wikilinkHelper.normalizeLinkTarget(m.lemma))
				: undefined;
		const base: MorphemeItem = {
			kind: m.kind,
			surf: normalizedSurf,
			...(normalizedLemma != null && { lemma: normalizedLemma }),
			...(m.separability != null && { separability: m.separability }),
		};

		if (m.kind === "Prefix" && targetLang === "German") {
			return {
				...base,
				linkTarget: buildPrefixTarget(normalizedRawSurf),
			};
		}

		return base;
	});
}
