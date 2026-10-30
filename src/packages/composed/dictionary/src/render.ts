/**
 * What the store renders into its notes: link resolutions from its index,
 * the projected inverse relations, and the notes a change moves links in.
 */

import {
	crossroadNotePath,
	type InflectionHook,
	type LinkResolver,
	type RenderOptions,
	sameTableVersions,
	shadowOf,
	tableVersionsOf,
	WORTER_FOLDER,
} from "@textfresser/lemma-note-codec";
import { canonicalJson } from "common-utils";
import { resolveShadow, spellingTarget } from "dumdict";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { type CrossroadContent, listsNothing, rendersAs } from "./crossroad";
import type { WriteOptions } from "./internal/dictionary-notes";
import type { MetadataFormat } from "./internal/note-metadata";
import {
	inverseRelationsHook,
	inverseRelationsReader,
} from "./inverse-relations";
import { formKeyOf, lemmaKeyOf, shadowKeyOf } from "./keys";
import { byCodeUnit, type NoteIndex, relationEdgesOf } from "./note-index";
import type { NoteData, PathEntry } from "./notes";

/** What a host renders into every note beyond the store's own projections. */
export type NoteProjections = Omit<
	RenderOptions<"de">,
	"paths" | "resolve" | "inverseRelations" | "morphemeSources"
>;

/**
 * The resolution the store holds for each link (ADR-0015, texteater#1221):
 *
 * - an exact Reading goes to its Reading note;
 * - a direct claim's Lemma, a Reading note's own Lemma and a table's form
 *   spelled as its Lemma go to the Lemma note;
 * - a pending relation, which is rendered only while unresolved, and a
 *   Lemma note's own spelling go to the Crossroad note;
 * - every other sense-unknown link (a Breakdown piece's or a Source's
 *   target, an inverse relation's source, a preposition not stored as
 *   named) goes to the Lemma note when it names a stored Lemma or its Unit
 *   Shadow matches exactly one, and to the Crossroad note otherwise.
 */
function linkResolver(view: NoteIndex): LinkResolver<"de"> {
	const byShadow = (shadow: Dumrel.UnitShadow & { language: "de" }) =>
		resolveShadow(
			shadow,
			view
				.lemmasNamedBy(shadowKeyOf(shadow))
				.flatMap((key) => view.lemmaData(key)?.lemmaRecord.lemma ?? []),
		);
	return ({ names, role }) => {
		switch (names.kind) {
			case "Reading":
				return { kind: "Reading", reading: names.reading };
			case "Shadow":
				return role === "pendingRelation" || role === "header"
					? spellingTarget(
							names.shadow.language,
							names.shadow.canonicalForm,
						)
					: byShadow(names.shadow);
			case "Lemma":
				// A table's form spelled as its own Lemma names that Lemma.
				if (
					role === "header" ||
					role === "relation" ||
					role === "inflection"
				)
					return { kind: "Lemma", lemma: names.lemma };
				if (
					role !== "inverseRelation" &&
					view.lemmaData(lemmaKeyOf(names.lemma))
				)
					return { kind: "Lemma", lemma: names.lemma };
				return byShadow(shadowOf(names.lemma));
		}
	};
}

/**
 * The morphemes line's lookup (dumrel's `LookupMorphemeSources`): the
 * stored Breakdown and Source of each Reading of a target's Lemma that has
 * either. None for a Unit Shadow, a part not stored yet, as tf-demo reads
 * it; the store re-points a Shadow to its Lemma (#267).
 */
function morphemeSourcesOf(
	view: NoteIndex,
): NonNullable<RenderOptions<"de">["morphemeSources"]> {
	return (target) => {
		if (!("unitKind" in target)) return [];
		return (
			view.lemmaData(lemmaKeyOf(target))?.readingEntries ?? []
		).flatMap(({ knowledge }) =>
			knowledge?.breakdown === undefined &&
			knowledge?.source === undefined
				? []
				: [
						{
							breakdown: knowledge.breakdown,
							source: knowledge.source,
						},
					],
		);
	};
}

/** The options every note write renders with, against one index version. */
export function renderOptionsFor(
	view: NoteIndex,
	projections: NoteProjections | undefined,
	format: MetadataFormat,
): { readonly options: WriteOptions<"de">; readonly failed: Set<string> } {
	const inverse = inverseRelationsReader(view);
	return {
		failed: inverse.failed,
		options: {
			...projections,
			format,
			inverseRelations: inverseRelationsHook(inverse.read),
			language: "de",
			morphemeSources: morphemeSourcesOf(view),
			resolve: linkResolver(view),
		},
	};
}

/** The form keys a Lemma's Crossroads are listed under: its own and its Surfaces'. */
function formKeysOf(data: NoteData): Set<string> {
	return new Set([
		formKeyOf(data.lemmaRecord.lemma.canonicalForm, "de"),
		...data.ownedSurfaceEntries.map(({ surface }) =>
			formKeyOf(surface.normalizedSurface, "de"),
		),
	]);
}

/** The Lemmas whose notes show inverse relations of these records' claims. */
function claimTargets(data: NoteData | undefined, into: Set<string>) {
	for (const entry of data?.readingEntries ?? [])
		for (const { targetLemmaKey } of relationEdgesOf(entry))
			into.add(targetLemmaKey);
}

/**
 * The Breakdowns and Sources a Lemma's Readings store, as one comparable
 * string: what another Reading's morphemes line reads of it.
 */
const morphemeSourcesKey = (data: NoteData | undefined): string =>
	canonicalJson(
		(data?.readingEntries ?? []).flatMap(({ knowledge }) =>
			knowledge?.breakdown === undefined &&
			knowledge?.source === undefined
				? []
				: [[knowledge.breakdown ?? null, knowledge.source ?? null]],
		),
	);

/** How far a morphemes line's walk reads up its parts: dumrel's own bound. */
const MORPHEME_WALK_DEPTH = 8;

/**
 * The Lemmas whose morphemes lines read these Lemmas' Breakdowns, up to the
 * walk's depth: a Lemma whose Breakdown names one, and so on up, since a
 * walk reads each part's own Breakdown (`Braunkohlekraftwerk` reads
 * `Kohlekraftwerk`, which reads `Kraftwerk`).
 */
function morphemeReaders(
	views: readonly NoteIndex[],
	changed: Iterable<string>,
): Set<string> {
	const readers = new Set<string>();
	let frontier = [...changed];
	for (
		let depth = 0;
		depth < MORPHEME_WALK_DEPTH && frontier.length > 0;
		depth++
	) {
		const next: string[] = [];
		for (const key of frontier)
			for (const view of views) {
				const lemma = view.lemmaData(key)?.lemmaRecord.lemma;
				if (lemma === undefined) continue;
				for (const reader of view.dependentsOf(shadowKeyOf(lemma)))
					if (!readers.has(reader)) {
						readers.add(reader);
						next.push(reader);
					}
			}
		frontier = next;
	}
	return readers;
}

/**
 * What a change to these Lemmas moves in other notes, from the index before
 * to the index after it:
 *
 * - the notes of every Lemma their claims target, which show inverse
 *   relations;
 * - when a Lemma comes or goes, the notes that link by its Unit Shadow,
 *   whose uniqueness it changes, and the targets of every claim made by a
 *   Lemma with that Shadow, whose inverse links name it;
 * - when a Lemma's Breakdowns or Sources change, or it comes or goes with
 *   one, the notes whose morphemes lines read it, up the walk;
 * - the Crossroads of every spelling the Lemmas or their Surfaces have.
 *
 * It answers more than may change; a re-render that changes nothing writes
 * nothing.
 */
export function fanOutOf(
	before: NoteIndex,
	after: NoteIndex,
	touched: Iterable<string>,
): { readonly lemmas: Set<string>; readonly formKeys: Set<string> } {
	const lemmas = new Set<string>();
	const formKeys = new Set<string>();
	const shadows = new Set<string>();
	const broken = new Set<string>();
	const own = new Set(touched);
	for (const key of own) {
		const was = before.lemmaData(key);
		const is = after.lemmaData(key);
		for (const data of [was, is]) {
			if (data) for (const form of formKeysOf(data)) formKeys.add(form);
			claimTargets(data, lemmas);
		}
		const lemma = (is ?? was)?.lemmaRecord.lemma;
		if (lemma && Boolean(was) !== Boolean(is))
			shadows.add(shadowKeyOf(lemma));
		if (morphemeSourcesKey(was) !== morphemeSourcesKey(is)) broken.add(key);
	}
	for (const key of morphemeReaders([before, after], broken)) lemmas.add(key);
	for (const shadow of shadows) {
		for (const view of [before, after]) {
			for (const key of view.dependentsOf(shadow)) lemmas.add(key);
			for (const key of view.lemmasNamedBy(shadow))
				claimTargets(
					after.lemmaData(key) ?? before.lemmaData(key),
					lemmas,
				);
		}
	}
	for (const key of own) lemmas.delete(key);
	return {
		formKeys,
		lemmas: new Set([...lemmas].filter((key) => after.lemmaData(key))),
	};
}

/** What the Crossroad note of a form key lists, from the index. */
export function crossroadContentOf(
	view: NoteIndex,
	key: string,
): CrossroadContent {
	const lemmas: {
		lemma: Dumling.Lemma<"de">;
		readings: Dumling.Reading<"de">[];
	}[] = [];
	const surfaces: { form: string; lemma: Dumling.Lemma<"de"> }[] = [];
	for (const lemmaKey of view.lemmasWithForm(key)) {
		const data = view.lemmaData(lemmaKey);
		if (!data) continue;
		const { lemma } = data.lemmaRecord;
		if (formKeyOf(lemma.canonicalForm, "de") === key) {
			lemmas.push({
				lemma,
				readings: data.readingEntries.map(({ reading }) => reading),
			});
			continue;
		}
		const forms = new Set(
			data.ownedSurfaceEntries
				.map(({ surface }) => surface.normalizedSurface)
				.filter((form) => formKeyOf(form, "de") === key),
		);
		for (const form of [...forms].sort(byCodeUnit))
			surfaces.push({ form, lemma });
	}
	return { key, lemmas, surfaces };
}

/** Crossroad paths by form key; spelling one is pure, and healing asks for every note's on each change. */
const crossroadPaths = new Map<string, string | undefined>();

/** The path of a form key's Crossroad note, or undefined if none can be spelled. */
export function crossroadPathOf(key: string): string | undefined {
	if (crossroadPaths.has(key)) return crossroadPaths.get(key);
	let path: string | undefined;
	try {
		path = crossroadNotePath(key, "de").path;
	} catch {
		path = undefined;
	}
	crossroadPaths.set(key, path);
	return path;
}

/**
 * The form key a Crossroad note is for: the one its metadata names, else
 * the stored spelling whose Crossroad sits at its path, else its name, as
 * for the empty note a click on an uncreated link leaves. Names are lossy,
 * so a name is taken only when it spells that very path back.
 */
function crossroadKeyOf(
	entry: Extract<PathEntry, { kind: "crossroad" }>,
	storedAt: ReadonlyMap<string, string>,
): string | undefined {
	if (entry.key !== undefined) return entry.key;
	const stored = storedAt.get(entry.path);
	if (stored !== undefined) return stored;
	const name = entry.path.split("/").at(-1)?.slice(0, -".md".length);
	return name !== undefined && crossroadPathOf(name) === entry.path
		? name
		: undefined;
}

/**
 * Whether the Crossroad note of a form key is missing or stale: missing
 * while its spelling has something to list, or a file there without
 * Crossroad metadata (a click's empty note, or text written by hand), or
 * metadata whose key or seals differ from what the index renders. It reads
 * no file: a note's seals say what it shows.
 */
function crossroadStale(view: NoteIndex, key: string): boolean {
	const path = crossroadPathOf(key);
	if (path === undefined) return false;
	const entry = view.entry(path);
	const content = crossroadContentOf(view, key);
	if (entry?.kind !== "crossroad") return !listsNothing(content);
	if (entry.key === undefined || entry.rendering === undefined) return true;
	return !rendersAs({ key: entry.key, rendering: entry.rendering }, content);
}

/**
 * The form keys whose Crossroad note is missing or stale, sorted: of every
 * spelling the index holds and of every Crossroad note there is, or only
 * of the Crossroad notes among `paths`. Regenerating them all writes what
 * the index renders, so a second run finds none.
 */
export function staleCrossroads(
	view: NoteIndex,
	paths?: Iterable<string>,
): string[] {
	const storedAt = new Map<string, string>();
	for (const key of view.formKeys()) {
		const path = crossroadPathOf(key);
		if (path !== undefined && !storedAt.has(path)) storedAt.set(path, key);
	}
	const keys = new Set<string>(paths === undefined ? view.formKeys() : []);
	const entries =
		paths === undefined
			? view.allEntries()
			: [...paths].flatMap((path) => view.entry(path) ?? []);
	for (const entry of entries) {
		if (entry.kind !== "crossroad") continue;
		const key = crossroadKeyOf(entry, storedAt);
		if (key !== undefined) keys.add(key);
	}
	return [...keys]
		.filter((key) => crossroadStale(view, key))
		.sort(byCodeUnit);
}

/**
 * The Lemmas whose Lemma note recorded other table versions than `hook`
 * renders now (#121), sorted: a pack or Table Schema change, or a note
 * written before versions were recorded. It reads no file: the index holds
 * what each note's metadata records. A hook that names no versions makes
 * none stale. Re-rendering them records the current versions, so a second
 * run finds none.
 */
export function staleTables(
	view: NoteIndex,
	hook: InflectionHook<"de"> | undefined,
	keys: Iterable<string> = view.lemmaKeys(),
): string[] {
	if (hook?.versions === undefined) return [];
	const stale: string[] = [];
	for (const key of new Set(keys)) {
		const note = view.lemmaNote(key);
		if (note === undefined) continue;
		const entry = view.entry(note.path);
		if (entry?.kind !== "lemma") continue;
		const current = tableVersionsOf(hook, note.data.lemmaRecord.lemma);
		if (!sameTableVersions(entry.tables, current)) stale.push(key);
	}
	return stale.sort(byCodeUnit);
}

/** Obsidian's names for a new note, such as `Untitled 2`: no spelling. */
const UNTITLED = /^Untitled(?: \d+)?$/u;

/**
 * A note that belongs at a Crossroad path but sits elsewhere: a stray, as
 * Obsidian creates one directly in `Worter/` for a click on an unresolved
 * bare link (`newFileFolderPath: Worter`), whose name is its spelling, or a
 * Crossroad note moved away from its own path.
 */
export type DisplacedCrossroad = {
	readonly from: string;
	/** Its spelling's Crossroad path. */
	readonly to: string;
	/** The spelling's form key. */
	readonly key: string;
	readonly kind: "stray" | "crossroad";
};

/**
 * Every displaced Crossroad note, by path. A stray named as Obsidian names
 * a new note (`Untitled`, `Untitled 2`) is no word, and stays a stray.
 */
export function displacedCrossroads(view: NoteIndex): DisplacedCrossroad[] {
	const displaced: DisplacedCrossroad[] = [];
	for (const entry of view.allEntries()) {
		if (entry.kind === "stray") {
			const name = entry.path.slice(
				`${WORTER_FOLDER}/`.length,
				-".md".length,
			);
			if (UNTITLED.test(name)) continue;
			const key = formKeyOf(name, "de");
			const to = crossroadPathOf(key);
			if (to !== undefined)
				displaced.push({ from: entry.path, key, kind: "stray", to });
			continue;
		}
		if (entry.kind !== "crossroad" || entry.key === undefined) continue;
		const to = crossroadPathOf(entry.key);
		if (to !== undefined && to !== entry.path)
			displaced.push({
				from: entry.path,
				key: entry.key,
				kind: "crossroad",
				to,
			});
	}
	return displaced.sort((a, b) => byCodeUnit(a.from, b.from));
}
