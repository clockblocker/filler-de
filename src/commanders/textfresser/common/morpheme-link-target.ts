/**
 * Converts lexical morphemes to MorphemeItem[] with resolved linkTarget.
 *
 * - Prefix (German): linkTarget = "{surf}-prefix-de" (Library canonical basename)
 * - Others: linkTarget stays undefined — formatter falls back to lemma ?? surf
 */

import type { LexicalMorpheme } from "@textfresser/lexical-generation";
import { wikilinkHelper } from "@textfresser/note-addressing/wikilink";
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
	morphemes: LexicalMorpheme[],
	targetLang: TargetLanguage,
): MorphemeItem[] {
	return morphemes.map((m): MorphemeItem => {
		const normalizedRawSurf = stripAnchor(
			wikilinkHelper.normalizeLinkTarget(m.surface),
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
			isSeparable: m.isSeparable,
			kind: m.kind,
			...(m.isSeparable !== undefined && {
				separability: m.isSeparable ? "Separable" : "Inseparable",
			}),
			surf: normalizedSurf,
			...(normalizedLemma != null && { lemma: normalizedLemma }),
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
