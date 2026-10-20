import { lemmaNotePath } from "@textfresser/lemma-note-codec";
import type {
	PendingSemanticRelationRecord,
	ReadingEntry,
	SurfaceEntry,
} from "dumdict";
import type * as Dumling from "dumling/types";
import {
	formKeyOf,
	lemmaKeyOf,
	locatorKeyOf,
	pendingShadowKeyOf,
	readingKeyOf,
	shadowKeyOf,
} from "./keys";
import {
	type LemmaNoteEntry,
	type NoteData,
	type PathEntry,
	pendingOfEntry,
} from "./note-entry";
import { shadowPathOfTarget } from "./shadow-note";

/** One direct Semantic Relation claim, as its source Reading stores it. */
export type RelationEdge = {
	readonly source: Dumling.Reading<"de">;
	readonly relation: string;
	readonly target:
		| { readonly kind: "lemma"; readonly lemma: Dumling.Lemma<"de"> }
		| { readonly kind: "reading"; readonly reading: Dumling.Reading<"de"> };
};

/** Where a Reading lives: its note and the Block ID of its part. */
export type ReadingLocation = {
	readonly path: string;
	readonly blockId: string;
	readonly entry: ReadingEntry<"de">;
};

/** The canonical path of a Lemma's note, or undefined if none can be spelled. */
export function canonicalLemmaPath(
	lemma: Dumling.Lemma<"de">,
): string | undefined {
	try {
		return lemmaNotePath(lemma).path;
	} catch {
		return undefined;
	}
}

/** The path of the Shadow note a pending relation's target gets. */
export const shadowPathOf = (
	record: PendingSemanticRelationRecord<"de">,
): string | undefined => shadowPathOfTarget(record.pending.target);

/** One file's claim on a Shadow note: the file's path and the relation's locator. */
export const shadowRefOf = (
	notePath: string,
	record: PendingSemanticRelationRecord<"de">,
): string => `${notePath}\u0000${locatorKeyOf(record.locator)}`;

/** Plain code-unit order, so paths that differ only by case sort one way everywhere. */
/**
 * A path as a case-insensitive, normalizing file system compares it, so
 * paths that differ only by letter case or Unicode form name one file.
 */
export const foldPath = (path: string): string =>
	path.normalize("NFC").toLowerCase();

export const byCodeUnit = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

function addTo<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
	const set = map.get(key);
	if (set) set.add(value);
	else map.set(key, new Set([value]));
}

function removeFrom<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
	const set = map.get(key);
	if (!set) return;
	set.delete(value);
	if (set.size === 0) map.delete(key);
}

function cloneSets<K, V>(map: Map<K, Set<V>>): Map<K, Set<V>> {
	return new Map([...map].map(([key, set]) => [key, new Set(set)]));
}

/** Each relation a Reading Entry claims, with its target's Lemma key. */
export function relationEdgesOf(
	entry: ReadingEntry<"de">,
): { readonly edge: RelationEdge; readonly targetLemmaKey: string }[] {
	const relations = entry.knowledge?.semanticRelations as
		| Readonly<Record<string, unknown>>
		| undefined;
	if (!relations) return [];
	const byReading = relations.targetKind === "reading";
	const edges: { edge: RelationEdge; targetLemmaKey: string }[] = [];
	for (const [relation, targets] of Object.entries(relations)) {
		if (relation === "targetKind" || !Array.isArray(targets)) continue;
		for (const target of targets) {
			if (byReading) {
				const reading = target as Dumling.Reading<"de">;
				edges.push({
					edge: {
						relation,
						source: entry.reading,
						target: { kind: "reading", reading },
					},
					targetLemmaKey: lemmaKeyOf(reading.lemma),
				});
			} else {
				const lemma = target as Dumling.Lemma<"de">;
				edges.push({
					edge: {
						relation,
						source: entry.reading,
						target: { kind: "lemma", lemma },
					},
					targetLemmaKey: lemmaKeyOf(lemma),
				});
			}
		}
	}
	return edges;
}

/**
 * The in-memory index over `Worter/`: every Markdown path's entry, and the
 * lookups dumdict's slices and dumgen read, derived from the Lemma notes
 * that hold each Lemma. When two notes hold one Lemma, a note already at
 * its own canonical path, else the first by path, holds it; the other is
 * reported as a duplicate and never written.
 *
 * The store never changes a published index: it clones it, changes the
 * clone under its writer lock, and swaps the clone in with the next
 * revision, so every read sees one consistent version.
 */
export class NoteIndex {
	private entries = new Map<string, PathEntry>();
	/** Case- and Unicode-folded path → the paths spelled that way. */
	private folded = new Map<string, Set<string>>();
	/** Lemma key → the paths of every note that holds it. */
	private claims = new Map<string, Set<string>>();
	/** Lemma key → the path of the note that holds it. */
	private holders = new Map<string, string>();
	private readings = new Map<
		string,
		{ readonly lemmaKey: string; readonly entry: ReadingEntry<"de"> }
	>();
	private surfaces = new Map<
		string,
		{ readonly lemmaKey: string; readonly entry: SurfaceEntry<"de"> }
	>();
	/** Form key of a Canonical Form or Surface → Lemma keys. */
	private forms = new Map<string, Set<string>>();
	/** Shadow key → keys of the Lemmas that Shadow names. */
	private lemmasByShadow = new Map<string, Set<string>>();
	private pending = new Map<
		string,
		{
			readonly lemmaKey: string;
			readonly record: PendingSemanticRelationRecord<"de">;
		}
	>();
	/** Shadow key → locator keys of the pending relations targeting it. */
	private pendingByShadow = new Map<string, Set<string>>();
	/**
	 * Shadow note path → every file's claim on it, holders, duplicates and
	 * quarantined notes alike, so no file's relation loses its Shadow.
	 */
	private shadowRefs = new Map<string, Set<string>>();
	/** Target Lemma key → edge key → edge. */
	private edgesByTarget = new Map<string, Map<string, RelationEdge>>();

	clone(): NoteIndex {
		const next = new NoteIndex();
		next.entries = new Map(this.entries);
		next.folded = cloneSets(this.folded);
		next.claims = cloneSets(this.claims);
		next.holders = new Map(this.holders);
		next.readings = new Map(this.readings);
		next.surfaces = new Map(this.surfaces);
		next.forms = cloneSets(this.forms);
		next.lemmasByShadow = cloneSets(this.lemmasByShadow);
		next.pending = new Map(this.pending);
		next.pendingByShadow = cloneSets(this.pendingByShadow);
		next.shadowRefs = cloneSets(this.shadowRefs);
		next.edgesByTarget = new Map(
			[...this.edgesByTarget].map(([key, edges]) => [
				key,
				new Map(edges),
			]),
		);
		return next;
	}

	entry(path: string): PathEntry | undefined {
		return this.entries.get(path);
	}

	paths(): string[] {
		return [...this.entries.keys()];
	}

	allEntries(): PathEntry[] {
		return [...this.entries.values()];
	}

	/** Sets or removes one path's entry and re-derives the lookups it feeds. */
	set(path: string, next: PathEntry | undefined): void {
		const previous = this.entries.get(path);
		const keys = new Set<string>();
		if (previous?.kind === "lemma") keys.add(previous.lemmaKey);
		if (next?.kind === "lemma") keys.add(next.lemmaKey);

		for (const key of keys) {
			const holder = this.holders.get(key);
			const held =
				holder === undefined ? undefined : this.entries.get(holder);
			if (held?.kind === "lemma") this.unindex(held);
			this.holders.delete(key);
		}
		for (const record of pendingOfEntry(previous)) {
			const shadowPath = shadowPathOf(record);
			if (shadowPath !== undefined)
				removeFrom(
					this.shadowRefs,
					foldPath(shadowPath),
					shadowRefOf(path, record),
				);
		}
		if (previous?.kind === "lemma")
			removeFrom(this.claims, previous.lemmaKey, path);
		if (next === undefined) this.entries.delete(path);
		else this.entries.set(path, next);
		if (previous === undefined && next !== undefined)
			addTo(this.folded, foldPath(path), path);
		if (previous !== undefined && next === undefined)
			removeFrom(this.folded, foldPath(path), path);
		if (next?.kind === "lemma") addTo(this.claims, next.lemmaKey, path);
		for (const record of pendingOfEntry(next)) {
			const shadowPath = shadowPathOf(record);
			if (shadowPath !== undefined)
				addTo(
					this.shadowRefs,
					foldPath(shadowPath),
					shadowRefOf(path, record),
				);
		}
		for (const key of keys) {
			const holder = this.pickHolder(key);
			if (holder === undefined) continue;
			this.holders.set(key, holder.path);
			this.index(holder);
		}
	}

	private pickHolder(key: string): LemmaNoteEntry | undefined {
		const notes = [...(this.claims.get(key) ?? [])]
			.sort(byCodeUnit)
			.map((path) => this.entries.get(path))
			.filter((entry) => entry?.kind === "lemma");
		const placed = notes.find(
			(note) =>
				note.path === canonicalLemmaPath(note.data.lemmaRecord.lemma),
		);
		return placed ?? notes[0];
	}

	private index(note: LemmaNoteEntry) {
		const { data, lemmaKey } = note;
		const lemma = data.lemmaRecord.lemma;
		addTo(this.forms, formKeyOf(lemma.canonicalForm, "de"), lemmaKey);
		addTo(this.lemmasByShadow, shadowKeyOf(lemma), lemmaKey);
		for (const entry of data.readingEntries) {
			this.readings.set(readingKeyOf(entry.reading), { entry, lemmaKey });
			for (const { edge, targetLemmaKey } of relationEdgesOf(entry)) {
				const edges =
					this.edgesByTarget.get(targetLemmaKey) ?? new Map();
				edges.set(edgeKeyOf(edge), edge);
				this.edgesByTarget.set(targetLemmaKey, edges);
			}
		}
		for (const entry of data.ownedSurfaceEntries) {
			this.surfaces.set(entry.id, { entry, lemmaKey });
			addTo(
				this.forms,
				formKeyOf(entry.surface.normalizedSurface, "de"),
				lemmaKey,
			);
		}
		for (const record of data.pendingRelations) {
			const locatorKey = locatorKeyOf(record.locator);
			this.pending.set(locatorKey, { lemmaKey, record });
			addTo(this.pendingByShadow, pendingShadowKeyOf(record), locatorKey);
		}
	}

	/** Removes everything a holding note gave; a Lemma has one holder, so this is exact. */
	private unindex(note: LemmaNoteEntry) {
		const { data, lemmaKey } = note;
		const lemma = data.lemmaRecord.lemma;
		removeFrom(this.forms, formKeyOf(lemma.canonicalForm, "de"), lemmaKey);
		removeFrom(this.lemmasByShadow, shadowKeyOf(lemma), lemmaKey);
		for (const entry of data.readingEntries) {
			this.readings.delete(readingKeyOf(entry.reading));
			for (const { edge, targetLemmaKey } of relationEdgesOf(entry)) {
				const edges = this.edgesByTarget.get(targetLemmaKey);
				edges?.delete(edgeKeyOf(edge));
				if (edges?.size === 0)
					this.edgesByTarget.delete(targetLemmaKey);
			}
		}
		for (const entry of data.ownedSurfaceEntries) {
			this.surfaces.delete(entry.id);
			removeFrom(
				this.forms,
				formKeyOf(entry.surface.normalizedSurface, "de"),
				lemmaKey,
			);
		}
		for (const record of data.pendingRelations) {
			const locatorKey = locatorKeyOf(record.locator);
			this.pending.delete(locatorKey);
			removeFrom(
				this.pendingByShadow,
				pendingShadowKeyOf(record),
				locatorKey,
			);
		}
	}

	/** The note that holds a Lemma, if any. */
	lemmaNote(lemmaKey: string): LemmaNoteEntry | undefined {
		const holder = this.holders.get(lemmaKey);
		const entry =
			holder === undefined ? undefined : this.entries.get(holder);
		return entry?.kind === "lemma" ? entry : undefined;
	}

	lemmaData(lemmaKey: string): NoteData | undefined {
		return this.lemmaNote(lemmaKey)?.data;
	}

	/** Every holding note, by path. */
	lemmaNotes(): LemmaNoteEntry[] {
		return [...this.holders.keys()]
			.flatMap((key) => {
				const note = this.lemmaNote(key);
				return note ? [note] : [];
			})
			.sort((a, b) => byCodeUnit(a.path, b.path));
	}

	reading(readingKey: string): ReadingEntry<"de"> | undefined {
		return this.readings.get(readingKey)?.entry;
	}

	readingLocation(readingKey: string): ReadingLocation | undefined {
		const found = this.readings.get(readingKey);
		if (!found) return undefined;
		const note = this.lemmaNote(found.lemmaKey);
		const blockId = note?.blockIds.readings.get(readingKey);
		return note && blockId
			? { blockId, entry: found.entry, path: note.path }
			: undefined;
	}

	surface(surfaceId: string): SurfaceEntry<"de"> | undefined {
		return this.surfaces.get(surfaceId)?.entry;
	}

	surfaceOwner(surfaceId: string): string | undefined {
		return this.surfaces.get(surfaceId)?.lemmaKey;
	}

	/** Keys of the Lemmas whose Canonical Form or owned Surface has this form key. */
	lemmasWithForm(formKey: string): readonly string[] {
		return [...(this.forms.get(formKey) ?? [])].sort(byCodeUnit);
	}

	/** Keys of the Lemmas a Shadow (language, Family, Kind, folded form) names, sorted. */
	lemmasNamedBy(shadowKey: string): readonly string[] {
		return [...(this.lemmasByShadow.get(shadowKey) ?? [])].sort(byCodeUnit);
	}

	pendingRecord(
		locatorKey: string,
	): PendingSemanticRelationRecord<"de"> | undefined {
		return this.pending.get(locatorKey)?.record;
	}

	pendingTargeting(shadowKey: string): PendingSemanticRelationRecord<"de">[] {
		return [...(this.pendingByShadow.get(shadowKey) ?? [])]
			.sort(byCodeUnit)
			.flatMap((key) => {
				const record = this.pending.get(key)?.record;
				return record ? [record] : [];
			});
	}

	/** Every file's claim on a Shadow note path (see {@link shadowRefOf}). */
	shadowClaims(path: string): ReadonlySet<string> {
		return this.shadowRefs.get(foldPath(path)) ?? new Set();
	}

	/**
	 * Indexed paths that name the same file as `path` on a case-insensitive
	 * file system, such as macOS's: `Bank.md` for `bank.md`.
	 */
	sameFileAs(path: string): readonly string[] {
		return [...(this.folded.get(foldPath(path)) ?? [])];
	}

	/** Every stored relation whose target is this Lemma or one of its Readings. */
	edgesTo(lemmaKey: string): RelationEdge[] {
		return [...(this.edgesByTarget.get(lemmaKey)?.values() ?? [])];
	}

	/** Paths of notes that hold a Lemma another note already holds. */
	duplicates(): { readonly path: string; readonly heldBy: string }[] {
		const result: { path: string; heldBy: string }[] = [];
		for (const [key, paths] of this.claims) {
			const holder = this.holders.get(key);
			if (holder === undefined) continue;
			for (const path of paths)
				if (path !== holder) result.push({ heldBy: holder, path });
		}
		return result.sort((a, b) => byCodeUnit(a.path, b.path));
	}

	/** Holding notes whose path is not their Lemma's canonical path. */
	misplaced(): { readonly from: string; readonly to: string | undefined }[] {
		const result: { from: string; to: string | undefined }[] = [];
		for (const holder of this.holders.values()) {
			const entry = this.entries.get(holder);
			if (entry?.kind !== "lemma") continue;
			const canonical = canonicalLemmaPath(entry.data.lemmaRecord.lemma);
			if (canonical !== holder)
				result.push({ from: holder, to: canonical });
		}
		return result.sort((a, b) => byCodeUnit(a.from, b.from));
	}

	/** Shadow notes the store wrote that no file's relation needs any more. */
	orphanShadows(): string[] {
		return this.allEntries()
			.filter(
				(entry) =>
					entry.kind === "shadow" &&
					entry.owned &&
					this.shadowClaims(entry.path).size === 0,
			)
			.map(({ path }) => path)
			.sort(byCodeUnit);
	}
}

const edgeKeyOf = (edge: RelationEdge): string =>
	JSON.stringify([
		readingKeyOf(edge.source),
		edge.relation,
		edge.target.kind === "lemma"
			? lemmaKeyOf(edge.target.lemma)
			: readingKeyOf(edge.target.reading),
	]);
