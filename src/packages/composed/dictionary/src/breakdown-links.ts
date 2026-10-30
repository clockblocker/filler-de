/**
 * Breakdown and Source links (#267; texteater ADR 0050, ADR-0015 "The Lemma
 * upgrade"). A Breakdown piece or a Source targets the Unit Shadow of its
 * part while the part is pending, and the part's Lemma while that Shadow
 * names exactly one stored Lemma (dumdict's `shadowMatchesLemma`).
 *
 * The link is reversible, as a Shadow relation's resolution is. The stored
 * target is the link's current resolution, and its Shadow is always there:
 * a Shadow target is its own, and a Lemma target's is `unitShadowOf` that
 * Lemma. The producers only ever write Shadows, and a Shadow names the same
 * Lemmas as the Shadow of any Lemma it matches, since both carry only the
 * language, Family, Kind and folded Canonical Form. So re-evaluation reads
 * the Shadow alone, never the previous resolution: a unique match moves the
 * link to that Lemma, and anything else moves it back to the Shadow. A link
 * moves back when der See joins die See, and forward again when one goes.
 */

import type { ReadingEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { lemmaKeyOf, readingKeyOf, shadowKeyOf } from "./keys";
import { isLemmaTarget, pointsBack, shadowOfTarget } from "./link-targets";
import { byCodeUnit, canonicalData, type NoteIndex } from "./note-index";
import type { NoteData } from "./notes";

/**
 * The owning Readings one commit moves links in, as tf-demo caps them
 * (`MAX_MOVED_OWNERS`). The rest move in follow-up commits of the same size.
 */
export const MAX_MOVED_OWNERS = 200;

type LinkTarget = Dumrel.LinkTarget;
type Lemma = Dumling.Lemma<"de">;

/** What a link resolves against: the stored Lemmas, as one index shows them. */
export type LinkResolver = {
	/** The stored Lemmas a Shadow key names. */
	readonly named: (shadowKey: string) => readonly Lemma[];
	/**
	 * Whether a Lemma target that no stored Lemma matches keeps its link:
	 * some file still holds the Lemma, unreadable for now, or the scan
	 * could not read every folder. Only a Lemma that is gone moves its
	 * links back to the Shadow.
	 */
	readonly held: (lemma: Lemma) => boolean;
	/** A stored Lemma's Reading Entries, to check a Source for pointing back. */
	readonly readingsOf: (lemma: Lemma) => readonly ReadingEntry<"de">[];
};

/**
 * The resolver over `view`'s Lemmas, or over the Lemmas a commit leaves:
 * `view`'s with `intended`'s records in place, a Lemma it maps to nothing
 * removed.
 */
export function resolverOver(
	view: NoteIndex,
	held: (lemma: Lemma) => boolean,
	intended: ReadonlyMap<string, NoteData | undefined> = new Map(),
): LinkResolver {
	const dataOf = (lemmaKey: string) =>
		intended.has(lemmaKey)
			? intended.get(lemmaKey)
			: view.lemmaData(lemmaKey);
	const lemmaOf = (lemmaKey: string) => dataOf(lemmaKey)?.lemmaRecord.lemma;
	return {
		held,
		named: (shadowKey) => {
			const keys = new Set(view.lemmasNamedBy(shadowKey));
			for (const [lemmaKey, data] of intended)
				if (data && shadowKeyOf(data.lemmaRecord.lemma) === shadowKey)
					keys.add(lemmaKey);
				else keys.delete(lemmaKey);
			return [...keys].sort(byCodeUnit).flatMap((lemmaKey) => {
				const lemma = lemmaOf(lemmaKey);
				return lemma ? [lemma] : [];
			});
		},
		readingsOf: (lemma) => dataOf(lemmaKeyOf(lemma))?.readingEntries ?? [],
	};
}

/** Where one link goes now; the same object when it stays. */
function settledTarget(target: LinkTarget, resolver: LinkResolver): LinkTarget {
	const shadow = shadowOfTarget(target);
	const named = resolver.named(shadowKeyOf(shadow));
	const [only, ...others] = named;
	if (only !== undefined && others.length === 0)
		return isLemmaTarget(target) && lemmaKeyOf(target) === lemmaKeyOf(only)
			? target
			: only;
	if (!isLemmaTarget(target)) return target;
	return named.length === 0 && resolver.held(target) ? target : shadow;
}

/**
 * A Reading Entry with every Breakdown and Source link settled against
 * `resolver`, or undefined when none moves. A Source never moves to a Lemma
 * one of whose stored Readings names the owner as its own Source
 * (texteater #1279, `pointsBack`): it stays on its Shadow, or goes back to
 * it. `pointsBack` matches a Shadow as it matches the Lemma it names, so
 * two such Sources both stay on their Shadows, whichever is settled first.
 * Running it again on its own answer moves nothing.
 */
export function settledEntry(
	entry: ReadingEntry<"de">,
	resolver: LinkResolver,
): ReadingEntry<"de"> | undefined {
	const { knowledge } = entry;
	if (knowledge === undefined) return undefined;
	let moved = false;
	const settle = <P extends { readonly target?: LinkTarget }>(
		piece: P,
	): P => {
		if (piece.target === undefined) return piece;
		const target = settledTarget(piece.target, resolver);
		if (target === piece.target) return piece;
		moved = true;
		return { ...piece, target };
	};
	const settleSource = <P extends { readonly target: LinkTarget }>(
		owner: Lemma,
		piece: P,
	): P => {
		const target = settledTarget(piece.target, resolver);
		const kept =
			isLemmaTarget(target) &&
			pointsBack(owner, target, [
				{ lemma: target, readings: resolver.readingsOf(target) },
			])
				? isLemmaTarget(piece.target)
					? shadowOfTarget(piece.target)
					: piece.target
				: target;
		if (kept === piece.target) return piece;
		moved = true;
		return { ...piece, target: kept };
	};
	const { breakdown, source } = knowledge;
	const next = {
		...knowledge,
		...(breakdown === undefined
			? {}
			: {
					breakdown: {
						...breakdown,
						...(breakdown.constituents === undefined
							? {}
							: {
									constituents:
										breakdown.constituents.map(settle),
								}),
						...(breakdown.morphemes === undefined
							? {}
							: { morphemes: breakdown.morphemes.map(settle) }),
					},
				}),
		...(source === undefined
			? {}
			: { source: settleSource(entry.reading.lemma, source) }),
	};
	return moved ? { ...entry, knowledge: next } : undefined;
}

/** A Lemma's records with every Reading's links settled, or undefined when none moves. */
export function settledData(
	data: NoteData,
	resolver: LinkResolver,
	readingKeys?: ReadonlySet<string>,
): NoteData | undefined {
	let moved = false;
	const readingEntries = data.readingEntries.map((entry) => {
		if (readingKeys && !readingKeys.has(readingKeyOf(entry.reading)))
			return entry;
		const settled = settledEntry(entry, resolver);
		if (settled === undefined) return entry;
		moved = true;
		return settled;
	});
	return moved ? canonicalData({ ...data, readingEntries }) : undefined;
}

/** The Shadow keys whose stored Lemmas a change to these Lemmas adds or removes. */
export function shadowKeysChangedBy(
	view: NoteIndex,
	intended: ReadonlyMap<string, NoteData | undefined>,
): Set<string> {
	const keys = new Set<string>();
	for (const [lemmaKey, data] of intended) {
		const was = view.lemmaData(lemmaKey)?.lemmaRecord.lemma;
		const is = data?.lemmaRecord.lemma;
		if (Boolean(was) !== Boolean(is))
			keys.add(shadowKeyOf((is ?? was) as Lemma));
	}
	return keys;
}

/** The owners whose links move, by Lemma, capped at `cap` Readings. */
export type MovedOwners = {
	/** Each owning Lemma's records with its links moved. */
	readonly intended: Map<string, NoteData>;
	/** Each owning Lemma's records as the index holds them. */
	readonly bases: Map<string, NoteData>;
	/** Readings whose links move: those moved first, then those over the cap. */
	readonly moved: number;
	/** The Shadow keys of the owners left over the cap. */
	readonly leftOver: Set<string>;
	/** The keys of the owning Readings whose links `intended` moves. */
	readonly readings: Set<string>;
};

/**
 * Moves the links of the stored Readings that link by these Shadow keys,
 * outside the Lemmas in `exclude`, up to `cap` Readings in code-unit order
 * of their keys (ADR-0015 "The Lemma upgrade"). An owner whose links
 * already fit counts for nothing, so running it again on what it answered
 * moves nothing.
 */
export function moveOwnerLinks(input: {
	readonly view: NoteIndex;
	readonly resolver: LinkResolver;
	readonly shadowKeys: Iterable<string>;
	readonly exclude?: ReadonlySet<string>;
	/** Owning Readings to leave alone, such as those a refused commit held. */
	readonly skipReadings?: ReadonlySet<string>;
	readonly cap?: number;
}): MovedOwners {
	const { view, resolver } = input;
	const cap = input.cap ?? MAX_MOVED_OWNERS;
	const owners = new Map<string, Set<string>>();
	for (const shadowKey of input.shadowKeys)
		for (const readingKey of view.linkOwnersOf(shadowKey)) {
			const keys = owners.get(readingKey) ?? new Set();
			keys.add(shadowKey);
			owners.set(readingKey, keys);
		}
	const intended = new Map<string, NoteData>();
	const bases = new Map<string, NoteData>();
	const leftOver = new Set<string>();
	const readings = new Set<string>();
	let moved = 0;
	for (const readingKey of [...owners.keys()].sort(byCodeUnit)) {
		const lemmaKey = view.readingOwner(readingKey);
		if (
			lemmaKey === undefined ||
			input.exclude?.has(lemmaKey) ||
			input.skipReadings?.has(readingKey)
		)
			continue;
		const base = view.lemmaData(lemmaKey);
		const entry = view.reading(readingKey);
		if (!base || !entry || !settledEntry(entry, resolver)) continue;
		moved += 1;
		if (moved > cap) {
			for (const key of owners.get(readingKey) ?? []) leftOver.add(key);
			continue;
		}
		const data = settledData(
			intended.get(lemmaKey) ?? base,
			resolver,
			new Set([readingKey]),
		);
		if (data === undefined) continue;
		intended.set(lemmaKey, data);
		bases.set(lemmaKey, base);
		readings.add(readingKey);
	}
	return { bases, intended, leftOver, moved, readings };
}
