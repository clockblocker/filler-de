/**
 * The targets a Reading's Breakdown pieces and Source link to (texteater
 * ADR 0050): a Lemma or a Unit Shadow, never a Reading. `breakdown-links.ts`
 * moves them; the index looks their owners up by these Shadow keys, and
 * Classify's Knowledge run checks a Source for pointing back with them.
 */

import type { ReadingEntry } from "dumdict";
import { unitShadowOf } from "dumdict/pending";
import { canonicalFormKey, lemmaIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Predicate } from "effect";
import { shadowKeyOf } from "./keys";

/** A Lemma target carries its `unitKind`; a Unit Shadow carries none. */
export const isLemmaTarget = (
	target: Dumrel.LinkTarget,
): target is Dumling.Lemma<"de"> => "unitKind" in target;

/** The Shadow a link waits on: its own, or its Lemma's (`unitShadowOf`). */
export const shadowOfTarget = (target: Dumrel.LinkTarget): Dumrel.UnitShadow =>
	isLemmaTarget(target) ? unitShadowOf(target) : target;

/** Every target a Reading's Breakdown pieces and Source link to. */
function linkTargetsOf(entry: ReadingEntry<"de">): Dumrel.LinkTarget[] {
	const { breakdown, source } = entry.knowledge ?? {};
	const targets: Dumrel.LinkTarget[] = [];
	for (const piece of [
		...(breakdown?.constituents ?? []),
		...(breakdown?.morphemes ?? []),
	])
		if (piece.target !== undefined) targets.push(piece.target);
	if (source !== undefined) targets.push(source.target);
	return targets;
}

/** The Shadow keys a Reading's Breakdown and Source links wait on. */
export function linkShadowKeysOf(entry: ReadingEntry<"de">): Set<string> {
	return new Set(
		linkTargetsOf(entry).map((target) =>
			shadowKeyOf(shadowOfTarget(target)),
		),
	);
}

/**
 * Whether a link target names `lemma`: a Lemma by identity, a Unit Shadow
 * by route and Canonical Form without letter case, as dumdict's
 * `shadowMatchesLemma` compares them.
 */
export function namesLemma(
	target: Dumrel.LinkTarget,
	lemma: Dumling.Lemma<"de">,
): boolean {
	if (isLemmaTarget(target))
		return lemmaIdentityKey(target) === lemmaIdentityKey(lemma);
	return (
		target.language === lemma.language &&
		target.family === lemma.family &&
		target.kind === lemma.kind &&
		canonicalFormKey(target.canonicalForm, lemma.language) ===
			canonicalFormKey(lemma.canonicalForm, lemma.language)
	);
}

/** A stored Lemma with its stored Readings' Knowledge, as a Source's base. */
export type StoredBase = {
	readonly lemma: Dumling.Lemma<"de">;
	readonly readings: readonly {
		readonly knowledge?: { readonly source?: { readonly target: unknown } };
	}[];
};

/**
 * Whether a Source to `target` points back (texteater #1279): a stored
 * Reading of a Lemma it names already names `owner` as its own Source.
 * The first stored direction wins. A base still pending has no stored
 * Readings, so it never conflicts.
 */
export function pointsBack(
	owner: Dumling.Lemma<"de">,
	target: Dumrel.LinkTarget,
	bases: readonly StoredBase[],
): boolean {
	if (target.language !== owner.language) return false;
	return bases.some(
		({ lemma, readings }) =>
			namesLemma(target, lemma) &&
			readings.some(({ knowledge }) => {
				const named = knowledge?.source?.target;
				return (
					Predicate.isObject(named) &&
					namesLemma(named as Dumrel.LinkTarget, owner)
				);
			}),
	);
}
