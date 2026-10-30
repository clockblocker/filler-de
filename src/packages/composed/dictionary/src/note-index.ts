import {
	type BreakdownSettled,
	lemmaNotePath,
	pathCollisionKey,
	readingNotePath,
} from "@textfresser/lemma-note-codec";
import type {
	AttestationLink,
	PendingSemanticRelationRecord,
	ReadingEntry,
	SurfaceEntry,
} from "dumdict";
import type * as Dumling from "dumling/types";
import { parseLemmaParadigm } from "dumrel";
import { Predicate } from "effect";
import {
	formKeyOf,
	lemmaKeyOf,
	locatorKeyOf,
	pendingShadowKeyOf,
	readingKeyOf,
	shadowKeyOf,
} from "./keys";
import { linkShadowKeysOf } from "./link-targets";
import type {
	LemmaNoteEntry,
	NoteData,
	PathEntry,
	ReadingNoteEntry,
} from "./notes";

/** One direct Semantic Relation claim, as its source Reading stores it. */
export type RelationEdge = {
	readonly source: Dumling.Reading<"de">;
	readonly relation: string;
	readonly target:
		| { readonly kind: "lemma"; readonly lemma: Dumling.Lemma<"de"> }
		| { readonly kind: "reading"; readonly reading: Dumling.Reading<"de"> };
};

/** Where a Reading lives: its Reading note, beside its Lemma note. */
export type ReadingLocation = {
	readonly path: string;
	readonly lemmaPath: string;
	readonly entry: ReadingEntry<"de">;
	/** Why its Breakdown is asked no more, as its note records it (#266). */
	readonly breakdownSettled?: BreakdownSettled;
};

function attempt(path: () => string): string | undefined {
	try {
		return path();
	} catch {
		return undefined;
	}
}

/** A Lemma note's path (ADR-0015), or undefined if none can be spelled. */
export const canonicalLemmaPath = (
	lemma: Dumling.Lemma<"de">,
): string | undefined => attempt(() => lemmaNotePath(lemma).path);

/** A Reading note's path (ADR-0015), or undefined if none can be spelled. */
export const canonicalReadingPath = (
	reading: Dumling.Reading<"de">,
): string | undefined => attempt(() => readingNotePath(reading).path);

/** Plain code-unit order, so paths that differ only by case sort one way everywhere. */
export const byCodeUnit = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

/** A Lemma's records in the order every note renders them: Readings by key. */
export function canonicalData(data: NoteData): NoteData {
	const readingEntries = [...data.readingEntries].sort((a, b) =>
		byCodeUnit(readingKeyOf(a.reading), readingKeyOf(b.reading)),
	);
	const order = new Map(
		readingEntries.map(({ reading }, index) => [
			readingKeyOf(reading),
			index,
		]),
	);
	const pendingRelations = [...data.pendingRelations].sort(
		(a, b) =>
			(order.get(readingKeyOf(a.sourceReading)) ?? 0) -
				(order.get(readingKeyOf(b.sourceReading)) ?? 0) ||
			byCodeUnit(locatorKeyOf(a.locator), locatorKeyOf(b.locator)),
	);
	return { ...data, pendingRelations, readingEntries };
}

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

function cloneMaps<K, J, V>(map: Map<K, Map<J, V>>): Map<K, Map<J, V>> {
	return new Map([...map].map(([key, inner]) => [key, new Map(inner)]));
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

const isShadowLike = (
	value: Record<string, unknown>,
): value is {
	language: Dumling.Language;
	family: string;
	kind: string;
	canonicalForm: string;
} =>
	Predicate.isString(value.language) &&
	Predicate.isString(value.family) &&
	Predicate.isString(value.kind) &&
	Predicate.isString(value.canonicalForm);

/**
 * The Shadow keys a Reading's Knowledge names outside its direct claims: a
 * morpheme's Unit Shadow, a Valency Frame's preposition, a participle's
 * source verb. Its note links each by uniqueness of its Shadow among the
 * stored Lemmas, so it must be rendered again when that set changes. It
 * may name more than the note links; a re-render that changes nothing
 * writes nothing.
 */
function knowledgeShadowKeys(entry: ReadingEntry<"de">): Set<string> {
	const keys = new Set<string>();
	const walk = (value: unknown) => {
		if (Array.isArray(value)) {
			for (const item of value) walk(item);
			return;
		}
		if (!Predicate.isObject(value)) return;
		const record = value as Record<string, unknown>;
		const { unitKind } = record;
		if (unitKind === "Reading") return;
		if (
			(unitKind === "Lemma" || unitKind === undefined) &&
			isShadowLike(record)
		)
			keys.add(shadowKeyOf(record));
		if (unitKind === "Lemma") return;
		for (const [key, field] of Object.entries(record))
			if (key !== "semanticRelations") walk(field);
	};
	walk(entry.knowledge);
	return keys;
}

/** A Lemma's notes as the index holds them. */
type Aggregate = {
	readonly lemmaKey: string;
	readonly lemmaPath: string;
	/** Each Reading's note, by Reading key. */
	readonly readingPaths: ReadonlyMap<string, string>;
	readonly data: NoteData;
	/** Why the Lemma is not read as data, when it is not. */
	readonly problem?: string;
};

/** A path whose file sits elsewhere than its metadata says. */
export type Misplaced = {
	readonly from: string;
	readonly to: string | undefined;
	/** The Lemma or Reading key the note holds. */
	readonly key: string;
};

/** A note the index does not read as data, beyond what its file says. */
export type IndexProblem =
	| {
			readonly path: string;
			readonly _tag: "DuplicateLemma" | "DuplicateReading";
			readonly heldBy: string;
	  }
	| {
			/** A Reading note whose Lemma no readable Lemma note holds. */
			readonly path: string;
			readonly _tag: "OrphanReading";
	  }
	| {
			/** A Lemma whose notes disagree, such as a Paradigm licensing a Reading without a note. */
			readonly path: string;
			readonly _tag: "InconsistentLemma";
			readonly message: string;
	  };

/**
 * The in-memory index over `Worter/`: every Markdown path's entry, each
 * Lemma's records gathered from its Lemma note and its Reading notes, and
 * the lookups dumdict's slices and dumgen read. A Reading note belongs to
 * the Lemma its metadata names, wherever it sits. When two notes hold one
 * Lemma or one Reading, the one at its own path, else the first by path,
 * holds it; the other is a duplicate and never written.
 *
 * The store never changes a published index: it clones it, changes the
 * clone under its writer lock, and swaps the clone in with the next
 * revision, so every read sees one consistent version.
 */
export class NoteIndex {
	private entries = new Map<string, PathEntry>();
	/** Collision key of a path → the paths spelled that way. */
	private folded = new Map<string, Set<string>>();
	/** Collision key of a folder → each spelling of it, with its file count. */
	private folders = new Map<string, Map<string, number>>();
	private lemmaClaims = new Map<string, Set<string>>();
	private readingClaims = new Map<string, Set<string>>();
	/** Lemma key → keys of the Readings some note claims for it. */
	private readingsOfLemma = new Map<string, Set<string>>();
	private aggregates = new Map<string, Aggregate>();

	// Lookups over the Lemmas read as data.
	private readings = new Map<
		string,
		{
			readonly lemmaKey: string;
			readonly entry: ReadingEntry<"de">;
			readonly path: string;
		}
	>();
	private surfaces = new Map<
		string,
		{ readonly lemmaKey: string; readonly entry: SurfaceEntry<"de"> }
	>();
	/** Form key of a Canonical Form or Surface → Lemma keys: the Crossroad index. */
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
	/** Target Lemma key → edge key → edge: the claims on a Lemma and its Readings. */
	private edgesByTarget = new Map<string, Map<string, RelationEdge>>();
	/** Attestation ref → Reading key → link. A ref is unique; more than one is a fault. */
	private refs = new Map<string, Map<string, AttestationLink<"de">>>();
	/** Surface ID → keys of the Readings whose links name it. */
	private surfaceLinks = new Map<string, Set<string>>();
	/** Shadow key → keys of the Lemmas whose notes link by it (morphemes, prepositions). */
	private dependents = new Map<string, Set<string>>();
	/**
	 * Shadow key → keys of the Readings whose Breakdown pieces or Source
	 * link by it, as a Shadow or as the Lemma it resolved to (#267).
	 */
	private linkOwners = new Map<string, Set<string>>();

	clone(): NoteIndex {
		const next = new NoteIndex();
		next.entries = new Map(this.entries);
		next.folded = cloneSets(this.folded);
		next.folders = cloneMaps(this.folders);
		next.lemmaClaims = cloneSets(this.lemmaClaims);
		next.readingClaims = cloneSets(this.readingClaims);
		next.readingsOfLemma = cloneSets(this.readingsOfLemma);
		next.aggregates = new Map(this.aggregates);
		next.readings = new Map(this.readings);
		next.surfaces = new Map(this.surfaces);
		next.forms = cloneSets(this.forms);
		next.lemmasByShadow = cloneSets(this.lemmasByShadow);
		next.pending = new Map(this.pending);
		next.pendingByShadow = cloneSets(this.pendingByShadow);
		next.edgesByTarget = cloneMaps(this.edgesByTarget);
		next.refs = cloneMaps(this.refs);
		next.surfaceLinks = cloneSets(this.surfaceLinks);
		next.dependents = cloneSets(this.dependents);
		next.linkOwners = cloneSets(this.linkOwners);
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

	/** Sets or removes one path's entry and re-derives the Lemmas it feeds. */
	set(path: string, next: PathEntry | undefined): void {
		const previous = this.entries.get(path);
		const affected = new Set<string>();
		for (const entry of [previous, next])
			if (entry?.kind === "lemma" || entry?.kind === "reading")
				affected.add(entry.lemmaKey);
		for (const key of affected) this.dropAggregate(key);

		if (previous?.kind === "lemma")
			removeFrom(this.lemmaClaims, previous.lemmaKey, path);
		if (previous?.kind === "reading") {
			removeFrom(this.readingClaims, previous.readingKey, path);
			if (!this.readingClaims.has(previous.readingKey))
				removeFrom(
					this.readingsOfLemma,
					previous.lemmaKey,
					previous.readingKey,
				);
		}
		if (next === undefined) this.entries.delete(path);
		else this.entries.set(path, next);
		if (previous === undefined && next !== undefined) this.addPath(path);
		if (previous !== undefined && next === undefined) this.removePath(path);
		if (next?.kind === "lemma")
			addTo(this.lemmaClaims, next.lemmaKey, path);
		if (next?.kind === "reading") {
			addTo(this.readingClaims, next.readingKey, path);
			addTo(this.readingsOfLemma, next.lemmaKey, next.readingKey);
		}
		for (const key of affected) this.buildAggregate(key);
	}

	private addPath(path: string) {
		addTo(this.folded, pathCollisionKey(path), path);
		for (const folder of foldersOf(path)) {
			const key = pathCollisionKey(folder);
			const spellings =
				this.folders.get(key) ?? new Map<string, number>();
			spellings.set(folder, (spellings.get(folder) ?? 0) + 1);
			this.folders.set(key, spellings);
		}
	}

	private removePath(path: string) {
		removeFrom(this.folded, pathCollisionKey(path), path);
		for (const folder of foldersOf(path)) {
			const key = pathCollisionKey(folder);
			const spellings = this.folders.get(key);
			if (!spellings) continue;
			const count = (spellings.get(folder) ?? 0) - 1;
			if (count > 0) spellings.set(folder, count);
			else spellings.delete(folder);
			if (spellings.size === 0) this.folders.delete(key);
		}
	}

	/** The note among `paths` that holds an identity: the one at `canonical`, else the first. */
	private holderOf(
		paths: ReadonlySet<string> | undefined,
		canonical: string | undefined,
	): string | undefined {
		const sorted = [...(paths ?? [])].sort(byCodeUnit);
		return sorted.find((path) => path === canonical) ?? sorted[0];
	}

	private buildAggregate(lemmaKey: string) {
		const lemmaPath = this.holderOf(
			this.lemmaClaims.get(lemmaKey),
			undefined,
		);
		if (lemmaPath === undefined) return;
		const claims = this.lemmaClaims.get(lemmaKey);
		const first = this.entries.get(lemmaPath) as LemmaNoteEntry;
		const canonical = canonicalLemmaPath(first.data.lemmaRecord.lemma);
		const holder = this.holderOf(claims, canonical) ?? lemmaPath;
		const lemmaNote = this.entries.get(holder) as LemmaNoteEntry;
		const readingPaths = new Map<string, string>();
		const readingEntries: ReadingEntry<"de">[] = [];
		const pendingRelations: PendingSemanticRelationRecord<"de">[] = [];
		for (const readingKey of [
			...(this.readingsOfLemma.get(lemmaKey) ?? []),
		].sort(byCodeUnit)) {
			const paths = this.readingClaims.get(readingKey);
			const any = this.holderOf(paths, undefined);
			if (any === undefined) continue;
			const sample = this.entries.get(any) as ReadingNoteEntry;
			const path =
				this.holderOf(
					paths,
					canonicalReadingPath(sample.data.readingEntry.reading),
				) ?? any;
			const note = this.entries.get(path) as ReadingNoteEntry;
			readingPaths.set(readingKey, path);
			readingEntries.push(note.data.readingEntry);
			pendingRelations.push(...note.data.pendingRelations);
		}
		const data = canonicalData({
			lemmaRecord: lemmaNote.data.lemmaRecord,
			ownedSurfaceEntries: lemmaNote.data.ownedSurfaceEntries,
			pendingRelations,
			readingEntries,
		});
		const problem = problemOf(data);
		const aggregate: Aggregate = {
			data,
			lemmaKey,
			lemmaPath: holder,
			readingPaths,
			...(problem === undefined ? {} : { problem }),
		};
		this.aggregates.set(lemmaKey, aggregate);
		if (problem === undefined) this.index(aggregate);
	}

	private dropAggregate(lemmaKey: string) {
		const aggregate = this.aggregates.get(lemmaKey);
		if (!aggregate) return;
		if (aggregate.problem === undefined) this.unindex(aggregate);
		this.aggregates.delete(lemmaKey);
	}

	private index(aggregate: Aggregate) {
		const { data, lemmaKey } = aggregate;
		const lemma = data.lemmaRecord.lemma;
		addTo(this.forms, formKeyOf(lemma.canonicalForm, "de"), lemmaKey);
		addTo(this.lemmasByShadow, shadowKeyOf(lemma), lemmaKey);
		for (const entry of data.readingEntries) {
			const readingKey = readingKeyOf(entry.reading);
			this.readings.set(readingKey, {
				entry,
				lemmaKey,
				path: aggregate.readingPaths.get(readingKey) ?? "",
			});
			for (const { edge, targetLemmaKey } of relationEdgesOf(entry)) {
				const edges =
					this.edgesByTarget.get(targetLemmaKey) ?? new Map();
				edges.set(edgeKeyOf(edge), edge);
				this.edgesByTarget.set(targetLemmaKey, edges);
			}
			for (const link of entry.attestationLinks) {
				const links = this.refs.get(link.ref) ?? new Map();
				links.set(readingKey, link);
				this.refs.set(link.ref, links);
				addTo(this.surfaceLinks, link.surfaceId, readingKey);
			}
			for (const key of knowledgeShadowKeys(entry))
				addTo(this.dependents, key, lemmaKey);
			for (const key of linkShadowKeysOf(entry))
				addTo(this.linkOwners, key, readingKey);
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

	/** Removes everything an aggregate gave; a Lemma has one aggregate, so this is exact. */
	private unindex(aggregate: Aggregate) {
		const { data, lemmaKey } = aggregate;
		const lemma = data.lemmaRecord.lemma;
		removeFrom(this.forms, formKeyOf(lemma.canonicalForm, "de"), lemmaKey);
		removeFrom(this.lemmasByShadow, shadowKeyOf(lemma), lemmaKey);
		for (const entry of data.readingEntries) {
			const readingKey = readingKeyOf(entry.reading);
			this.readings.delete(readingKey);
			for (const { edge, targetLemmaKey } of relationEdgesOf(entry)) {
				const edges = this.edgesByTarget.get(targetLemmaKey);
				edges?.delete(edgeKeyOf(edge));
				if (edges?.size === 0)
					this.edgesByTarget.delete(targetLemmaKey);
			}
			for (const link of entry.attestationLinks) {
				const links = this.refs.get(link.ref);
				links?.delete(readingKey);
				if (links?.size === 0) this.refs.delete(link.ref);
				removeFrom(this.surfaceLinks, link.surfaceId, readingKey);
			}
			for (const key of knowledgeShadowKeys(entry))
				removeFrom(this.dependents, key, lemmaKey);
			for (const key of linkShadowKeysOf(entry))
				removeFrom(this.linkOwners, key, readingKey);
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

	/** A Lemma read as data: its notes' paths and its records. */
	lemmaNote(lemmaKey: string):
		| {
				readonly path: string;
				readonly readingPaths: ReadonlyMap<string, string>;
				readonly data: NoteData;
		  }
		| undefined {
		const aggregate = this.aggregates.get(lemmaKey);
		return aggregate && aggregate.problem === undefined
			? {
					data: aggregate.data,
					path: aggregate.lemmaPath,
					readingPaths: aggregate.readingPaths,
				}
			: undefined;
	}

	lemmaData(lemmaKey: string): NoteData | undefined {
		return this.lemmaNote(lemmaKey)?.data;
	}

	/** The keys of every Lemma read as data. */
	lemmaKeys(): string[] {
		return [...this.aggregates.values()]
			.filter(({ problem }) => problem === undefined)
			.map(({ lemmaKey }) => lemmaKey);
	}

	/** Every Lemma read as data, with its Lemma note's path, by path. */
	lemmaNotes(): { readonly path: string; readonly data: NoteData }[] {
		return [...this.aggregates.values()]
			.filter(({ problem }) => problem === undefined)
			.map(({ data, lemmaPath }) => ({ data, path: lemmaPath }))
			.sort((a, b) => byCodeUnit(a.path, b.path));
	}

	reading(readingKey: string): ReadingEntry<"de"> | undefined {
		return this.readings.get(readingKey)?.entry;
	}

	readingOwner(readingKey: string): string | undefined {
		return this.readings.get(readingKey)?.lemmaKey;
	}

	readingLocation(readingKey: string): ReadingLocation | undefined {
		const found = this.readings.get(readingKey);
		if (!found) return undefined;
		const lemmaPath = this.aggregates.get(found.lemmaKey)?.lemmaPath;
		if (lemmaPath === undefined) return undefined;
		const note = this.entry(found.path);
		const settled =
			note?.kind === "reading" ? note.data.breakdownSettled : undefined;
		return {
			entry: found.entry,
			lemmaPath,
			path: found.path,
			...(settled === undefined ? {} : { breakdownSettled: settled }),
		};
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

	/** Every form key some stored Lemma or owned Surface has: every spelling with a Crossroad. */
	formKeys(): string[] {
		return [...this.forms.keys()].sort(byCodeUnit);
	}

	/** Keys of the Lemmas a Shadow (language, Family, Kind, folded form) names, sorted. */
	lemmasNamedBy(shadowKey: string): readonly string[] {
		return [...(this.lemmasByShadow.get(shadowKey) ?? [])].sort(byCodeUnit);
	}

	/** Keys of the Lemmas whose notes link something by this Shadow key. */
	dependentsOf(shadowKey: string): readonly string[] {
		return [...(this.dependents.get(shadowKey) ?? [])].sort(byCodeUnit);
	}

	/**
	 * Keys of the Readings whose Breakdown pieces or Source link by this
	 * Shadow key, whether they target the Shadow or a Lemma it names, sorted.
	 */
	linkOwnersOf(shadowKey: string): readonly string[] {
		return [...(this.linkOwners.get(shadowKey) ?? [])].sort(byCodeUnit);
	}

	/**
	 * Keys of the Lemmas whose Breakdowns or Sources name this Shadow key,
	 * Lemma targets included, sorted: the owners of {@link linkOwnersOf},
	 * by Lemma, which the morphemes line's walk reads up (#268).
	 */
	breakdownReadersOf(shadowKey: string): readonly string[] {
		const lemmas = new Set<string>();
		for (const readingKey of this.linkOwners.get(shadowKey) ?? []) {
			const owner = this.readings.get(readingKey)?.lemmaKey;
			if (owner !== undefined) lemmas.add(owner);
		}
		return [...lemmas].sort(byCodeUnit);
	}

	/** Every Shadow key some Breakdown piece or Source links by, sorted. */
	linkShadowKeys(): string[] {
		return [...this.linkOwners.keys()].sort(byCodeUnit);
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

	/** Every stored pending relation, by locator. */
	allPending(): PendingSemanticRelationRecord<"de">[] {
		return [...this.pending.keys()].sort(byCodeUnit).flatMap((key) => {
			const record = this.pending.get(key)?.record;
			return record ? [record] : [];
		});
	}

	/** Every stored relation whose target is this Lemma or one of its Readings. */
	edgesTo(lemmaKey: string): RelationEdge[] {
		return [...(this.edgesByTarget.get(lemmaKey)?.values() ?? [])];
	}

	/**
	 * Every note that holds a Lemma or one of its Readings, duplicates
	 * included: what removing the Lemma removes.
	 */
	notesOf(lemmaKey: string): {
		readonly lemma: readonly string[];
		readonly readings: ReadonlyMap<string, readonly string[]>;
	} {
		return {
			lemma: [...(this.lemmaClaims.get(lemmaKey) ?? [])].sort(byCodeUnit),
			readings: new Map(
				[...(this.readingsOfLemma.get(lemmaKey) ?? [])].map((key) => [
					key,
					[...(this.readingClaims.get(key) ?? [])].sort(byCodeUnit),
				]),
			),
		};
	}

	/** Whether some file holds this Lemma, read as data or not. */
	holdsAnyNoteOf(lemma: Dumling.Lemma<"de">): boolean {
		if (this.lemmaClaims.has(lemmaKeyOf(lemma))) return true;
		const path = canonicalLemmaPath(lemma);
		return path !== undefined && this.sameFileAs(path).length > 0;
	}

	/** The keys of every Lemma some stored claim targets, stored or not. */
	claimedLemmaKeys(): string[] {
		return [...this.edgesByTarget.keys()];
	}

	/** Every stored Attestation Link with this ref. */
	linksWithRef(ref: string): AttestationLink<"de">[] {
		return [...(this.refs.get(ref)?.values() ?? [])];
	}

	/** Every stored Attestation Link whose ref starts with `prefix`. */
	linksWithRefPrefix(prefix: string): AttestationLink<"de">[] {
		const links: AttestationLink<"de">[] = [];
		for (const [ref, byReading] of this.refs)
			if (ref.startsWith(prefix)) links.push(...byReading.values());
		return links;
	}

	/** Every stored Reading whose links name this Surface. */
	readingsLinking(surfaceId: string): ReadingEntry<"de">[] {
		return [...(this.surfaceLinks.get(surfaceId) ?? [])]
			.sort(byCodeUnit)
			.flatMap((key) => {
				const entry = this.reading(key);
				return entry ? [entry] : [];
			});
	}

	/**
	 * Indexed paths that name the same file as `path` on a case-insensitive,
	 * normalizing file system: `Bank.md` for `bank.md`, `MASSE.md` for
	 * `Maße.md` (ADR-0015's collision key).
	 */
	sameFileAs(path: string): readonly string[] {
		return [...(this.folded.get(pathCollisionKey(path)) ?? [])];
	}

	/**
	 * A folder of `path` that the vault already spells another way, which a
	 * case-insensitive file system holds as one folder.
	 */
	folderCollision(
		path: string,
	): { readonly folder: string; readonly existing: string } | undefined {
		for (const folder of foldersOf(path)) {
			const spellings = this.folders.get(pathCollisionKey(folder));
			if (spellings === undefined || spellings.has(folder)) continue;
			const [existing] = [...spellings.keys()].sort(byCodeUnit);
			if (existing !== undefined) return { existing, folder };
		}
		return undefined;
	}

	/** Notes the index does not read as data, beyond their own file. */
	problems(): IndexProblem[] {
		const result: IndexProblem[] = [];
		for (const [key, paths] of this.lemmaClaims) {
			const aggregate = this.aggregates.get(key);
			if (aggregate === undefined) continue;
			for (const path of paths)
				if (path !== aggregate.lemmaPath)
					result.push({
						_tag: "DuplicateLemma",
						heldBy: aggregate.lemmaPath,
						path,
					});
			if (aggregate.problem !== undefined)
				result.push({
					_tag: "InconsistentLemma",
					message: aggregate.problem,
					path: aggregate.lemmaPath,
				});
		}
		for (const [readingKey, paths] of this.readingClaims) {
			const sample = this.entries.get([...paths][0] ?? "");
			if (sample?.kind !== "reading") continue;
			const aggregate = this.aggregates.get(sample.lemmaKey);
			const holder = aggregate?.readingPaths.get(readingKey);
			for (const path of paths)
				if (aggregate === undefined || aggregate.problem !== undefined)
					result.push({ _tag: "OrphanReading", path });
				else if (holder !== undefined && path !== holder)
					result.push({
						_tag: "DuplicateReading",
						heldBy: holder,
						path,
					});
		}
		return result.sort((a, b) => byCodeUnit(a.path, b.path));
	}

	/** Holding notes whose path is not their identity's path. */
	misplaced(): Misplaced[] {
		const result: Misplaced[] = [];
		for (const aggregate of this.aggregates.values()) {
			if (aggregate.problem !== undefined) continue;
			const canonical = canonicalLemmaPath(
				aggregate.data.lemmaRecord.lemma,
			);
			if (canonical !== aggregate.lemmaPath)
				result.push({
					from: aggregate.lemmaPath,
					key: aggregate.lemmaKey,
					to: canonical,
				});
			for (const { reading } of aggregate.data.readingEntries) {
				const key = readingKeyOf(reading);
				const path = aggregate.readingPaths.get(key);
				const target = canonicalReadingPath(reading);
				if (path !== undefined && path !== target)
					result.push({ from: path, key, to: target });
			}
		}
		return result.sort((a, b) => byCodeUnit(a.from, b.from));
	}
}

/** Each folder of a path, shallowest first, without `Worter` itself. */
function foldersOf(path: string): string[] {
	const parts = path.normalize("NFC").split("/");
	const folders: string[] = [];
	for (let end = 2; end < parts.length; end++)
		folders.push(parts.slice(0, end).join("/"));
	return folders;
}

/**
 * Why a Lemma's notes are not one valid Lemma: a Foreign Lemma with more
 * than one Reading, or a Paradigm that licenses a Reading no note holds.
 */
function problemOf(data: NoteData): string | undefined {
	const { lemma, paradigm } = data.lemmaRecord;
	if (lemma.family === "Foreign" && data.readingEntries.length > 1)
		return "A Foreign Lemma has exactly one Reading";
	if (paradigm === undefined) return undefined;
	const parsed = parseLemmaParadigm({
		lemma,
		paradigm,
		readings: data.readingEntries.map(({ reading }) => reading),
	});
	return parsed.success
		? undefined
		: `Its Paradigm does not fit its Reading notes: ${parsed.error.message}`;
}

const edgeKeyOf = (edge: RelationEdge): string =>
	JSON.stringify([
		readingKeyOf(edge.source),
		edge.relation,
		edge.target.kind === "lemma"
			? lemmaKeyOf(edge.target.lemma)
			: readingKeyOf(edge.target.reading),
	]);
