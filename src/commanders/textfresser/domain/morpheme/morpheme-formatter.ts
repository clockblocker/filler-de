/**
 * Morpheme formatting utilities.
 * Converts structured LLM morpheme output into wikilink display strings.
 */

import type { MorphemeKind } from "../../../../linguistics/common/enums/linguistic-units/morphem/morpheme-kind";
import { wikilinkHelper } from "../../../../stateless-helpers/wikilink";
import type { TargetLanguage } from "../../../../types";

export type MorphemeItem = {
	kind: MorphemeKind;
	surf: string;
	lemma?: string;
	separability?: "Separable" | "Inseparable";
	/** Resolved note basename for wikilink. Overrides default lemma/surf target. */
	linkTarget?: string;
};

/**
 * Apply notation decoration to a morpheme surface based on separability.
 * `>surf` on a prefix = separable (trennbar) — "I can detach"
 * `surf<` on a prefix = inseparable (untrennbar) — "I stay attached"
 */
function decorateSurface(
	surf: string,
	separability: "Separable" | "Inseparable" | undefined,
	targetLang: TargetLanguage,
): string {
	if (!separability || targetLang !== "German") return surf;

	switch (separability) {
		case "Separable":
			return `>${surf}`;
		case "Inseparable":
			return `${surf}<`;
	}
}

/**
 * Format a single morpheme as a wikilink string.
 *
 * - No lemma, no separability → `[[surf]]`
 * - With lemma (different from surf) → `[[lemma|surf]]`
 * - With separability → `[[surf|>surf]]` (decorated surface as alias)
 * - With both lemma and separability → `[[lemma|>surf]]`
 * - With linkTarget → overrides default target: `[[linkTarget|decorated]]`
 * - lemma === surf → treated as no lemma
 */
function formatAsWikilink(
	item: MorphemeItem,
	_targetLang: TargetLanguage,
): string {
	const display = item.surf;
	const target = wikilinkHelper.normalizeLinkTarget(
		item.linkTarget ??
			(item.lemma && item.lemma !== item.surf ? item.lemma : item.surf),
	);

	if (target.toLowerCase() === display.toLowerCase()) return `[[${target}]]`;
	return `[[${target}|${display}]]`;
}

/**
 * Format a full morphemes array into a pipe-separated wikilink string.
 *
 * Example: aufpassen → `[[auf-prefix-de|>auf]]|[[passen]]`
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
