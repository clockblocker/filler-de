/**
 * Morpheme formatting utilities.
 * Converts structured LLM morpheme output into wikilink display strings.
 */

import type { MorphemeKind } from "../linguistics/common/enums/linguistic-units/morphem/morpheme-kind";
import type { MorphemeTag } from "../linguistics/common/enums/linguistic-units/morphem/morpheme-tag";
import type { TargetLanguage } from "../types";

type MorphemeItem = {
	kind: MorphemeKind;
	surf: string;
	lemma?: string;
	tags?: MorphemeTag[];
};

/**
 * Per-language surface decoration transforms.
 * `>surf` on a prefix = separable (trennbar) — "I can detach"
 * `surf<` on a prefix = inseparable (untrennbar) — "I stay attached"
 */
const TRANSFORMS: Record<
	TargetLanguage,
	Partial<Record<MorphemeTag, (s: string) => string>>
> = {
	English: {},
	German: {
		Inseparable: (s) => `${s}<`,
		Separable: (s) => `>${s}`,
	},
};

/**
 * Apply notation decoration to a morpheme surface based on its tags.
 * Returns the first matching tag transform, or the raw surface if no tags match.
 */
function decorateSurface(
	surf: string,
	tags: MorphemeTag[] | undefined,
	targetLang: TargetLanguage,
): string {
	if (!tags || tags.length === 0) return surf;

	const langTransforms = TRANSFORMS[targetLang];
	for (const tag of tags) {
		const transform = langTransforms[tag];
		if (transform) return transform(surf);
	}
	return surf;
}

/**
 * Format a single morpheme as a wikilink string.
 *
 * - No lemma, no tags → `[[surf]]`
 * - With lemma (different from surf) → `[[lemma|surf]]`
 * - With tags → `[[surf|>surf]]` (decorated surface as alias)
 * - With both lemma and tags → `[[lemma|>surf]]`
 * - lemma === surf → treated as no lemma
 */
function formatAsWikilink(
	item: MorphemeItem,
	targetLang: TargetLanguage,
): string {
	const decorated = decorateSurface(item.surf, item.tags, targetLang);
	const target =
		item.lemma && item.lemma !== item.surf ? item.lemma : item.surf;

	if (target === decorated) return `[[${target}]]`;
	return `[[${target}|${decorated}]]`;
}

/**
 * Format a full morphemes array into a pipe-separated wikilink string.
 *
 * Example: aufpassen → `[[auf|>auf]]|[[passen]]`
 */
function formatSection(
	morphemes: MorphemeItem[],
	targetLang: TargetLanguage,
): string {
	return morphemes.map((m) => formatAsWikilink(m, targetLang)).join("|");
}

export const morphemeFormatterHelper = {
	decorateSurface,
	formatAsWikilink,
	formatSection,
};
