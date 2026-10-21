import {
	type InflectionPack,
	type LemmaTablesView,
	projectLemmaTables,
	type SurfaceAxes,
} from "dumdict/inflection";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { tableBlockIds } from "./block-ids";
import type { LinkRenderer } from "./links";
import { emojiOf } from "./render/common";
import { drawTable, type TableDrawer } from "./render/table";
import type { LemmaRecords, SurfaceId } from "./types";

/**
 * Inflection tables (spec: Projections). A Lemma note shows one table per
 * Licence Group, and each Reading note embeds its group's. The codec only
 * lays tables out: an {@link InflectionHook} renders them, normally from
 * `dumdict/inflection`'s `projectLemmaTables` and a language's Inflection
 * Pack ({@link inflectionFromPack}).
 */

/** One Licence Group's table, as a hook renders it. */
export type RenderedTable<L extends Dumling.Language> = {
	/** The group's `selectionKey`, which its Block ID hashes. */
	readonly selectionKey: string;
	/** The group's Readings, which its caption shows and which embed it. */
	readonly readings: readonly Dumling.Reading<L>[];
	/**
	 * The table as Markdown lines that read as one paragraph: no blank line
	 * and no Block ID, which the codec adds. No lines: the group has no
	 * table, and its Readings embed none.
	 */
	readonly lines: readonly string[];
};

/** How a met Surface's line describes where it sits: `Dat.Pl`. */
export type RenderedSurfaceAxes<L extends Dumling.Language> = {
	readonly surfaceId: SurfaceId<L>;
	readonly axes: string;
	/** Marks after the axes, such as a Licence Conflict's `⚠ 🪑 → 🏦`. */
	readonly marks?: readonly string[];
};

export type RenderedInflection<L extends Dumling.Language> = {
	/** Every Licence Group of the Lemma, in the order they show. */
	readonly tables: readonly RenderedTable<L>[];
	/** Surface Axes of the met Surfaces; a Surface left out shows its form alone. */
	readonly surfaces?: readonly RenderedSurfaceAxes<L>[];
};

/** What a hook reads: the Lemma's records and the note's link renderer. */
export type InflectionInput<L extends Dumling.Language> = {
	readonly records: LemmaRecords<L>;
	readonly link: LinkRenderer<L>;
};

/**
 * The versions a Lemma's tables are rendered at (system ADR 0049): its
 * Inflection Pack's, and its Table Schema's id and version when it has one.
 * Tables are projections, so a note rendered at other versions shows stale
 * tables; a Lemma note records these, and the store re-renders a note that
 * recorded others (#121).
 */
export type TableVersions = {
	readonly pack: string;
	readonly schema?: { readonly id: string; readonly version: number };
};

/** Renders a Lemma's tables, or undefined when it has none. Pure. */
export type InflectionHook<L extends Dumling.Language> = ((
	input: InflectionInput<L>,
) => RenderedInflection<L> | undefined) & {
	/**
	 * The versions the hook renders a Lemma's tables at. Pure and cheap: the
	 * store asks it for every Lemma at each full read, without rendering.
	 * A hook without it records none, and its notes are never re-rendered
	 * for a version change.
	 */
	readonly versions?: (lemma: Dumling.Lemma<L>) => TableVersions | undefined;
};

/** The versions `hook` renders `lemma`'s tables at, if it names any. */
export function tableVersionsOf<L extends Dumling.Language>(
	hook: InflectionHook<L> | undefined,
	lemma: Dumling.Lemma<L>,
): TableVersions | undefined {
	return hook?.versions?.(lemma);
}

/** Whether two notes' recorded table versions are the same. */
export function sameTableVersions(
	left: TableVersions | undefined,
	right: TableVersions | undefined,
): boolean {
	return (
		left?.pack === right?.pack &&
		left?.schema?.id === right?.schema?.id &&
		left?.schema?.version === right?.schema?.version
	);
}

/** One Licence Group's table in a note, with its Block ID. */
export type LemmaTable<L extends Dumling.Language> = RenderedTable<L> & {
	readonly blockId: string;
};

export type LemmaTables<L extends Dumling.Language> = {
	readonly tables: readonly LemmaTable<L>[];
	/** Each met Surface's line after its form, by Surface id: its axes, then its marks. */
	readonly surfaceAxes: ReadonlyMap<string, string>;
};

/**
 * The tables a Lemma's notes show, with their Block IDs. IDs are assigned
 * over every group the hook names, so one group's table emptying never
 * moves another's ID. A table without lines is left out.
 */
export function lemmaTables<L extends Dumling.Language>(
	hook: InflectionHook<L> | undefined,
	input: InflectionInput<L>,
): LemmaTables<L> {
	const rendered = hook?.(input);
	if (rendered === undefined) return { surfaceAxes: new Map(), tables: [] };
	const ids = tableBlockIds(
		rendered.tables.map(({ selectionKey }) => selectionKey),
	);
	return {
		surfaceAxes: new Map(
			(rendered.surfaces ?? []).map(({ axes, marks = [], surfaceId }) => [
				surfaceId as string,
				[axes, ...marks]
					.map((part) => part.trim())
					.filter((part) => part.length > 0)
					.join(" "),
			]),
		),
		tables: rendered.tables
			.filter(({ lines }) => lines.length > 0)
			.map((table) => ({
				...table,
				blockId: ids.get(table.selectionKey) ?? "t",
			})),
	};
}

/** The table a Reading's note embeds: its Licence Group's. */
export function tableOfReading<L extends Dumling.Language>(
	tables: LemmaTables<L>,
	reading: Dumling.Reading<L>,
): LemmaTable<L> | undefined {
	const key = readingIdentityKey(reading);
	return tables.tables.find((table) =>
		table.readings.some((member) => readingIdentityKey(member) === key),
	);
}

/**
 * Marks for the Surfaces whose occurrences are Licence Conflicts: a form
 * met under a Reading whose Licence doesn't take it (`Banken` under 🪑).
 * Each gets one `⚠ <Reading> → <groups it fits>` per Reading, by emoji. A
 * conflict is never written into a table; this is where it shows.
 */
function conflictMarks<L extends Dumling.Language, F>(
	view: LemmaTablesView<L, F>,
	records: LemmaRecords<L>,
): ReadonlyMap<string, readonly string[]> {
	const readings = new Map(
		records.readingEntries.map(({ reading }) => [
			readingIdentityKey(reading) as string,
			reading,
		]),
	);
	const shown = (reading: Dumling.Reading<L> | undefined) =>
		reading === undefined
			? "?"
			: (emojiOf(reading) ?? reading.lemma.canonicalForm);
	const groups = new Map(
		view.groups.map((group) => [
			group.selectionKey,
			group.readings.map(shown).join(" "),
		]),
	);
	const marks = new Map<string, string[]>();
	const seen = new Set<string>();
	for (const conflict of view.conflicts) {
		const key = JSON.stringify([conflict.surfaceId, conflict.reading]);
		if (seen.has(key)) continue;
		seen.add(key);
		const fits = conflict.fitsGroups
			.map((selectionKey) => groups.get(selectionKey) ?? "?")
			.join(", ");
		const list = marks.get(conflict.surfaceId) ?? [];
		list.push(`⚠ ${shown(readings.get(conflict.reading))} → ${fits}`);
		marks.set(conflict.surfaceId, list);
	}
	return marks;
}

/**
 * A met Surface's axes through the pack's `labels.bundle`: the bundles of
 * the cells it Covers, `, ` between them, or of the cells it may be OneOf,
 * ` / ` between them, then its bundles that fit no cell.
 */
function axesOf<L extends Dumling.Language, F>(
	axes: SurfaceAxes,
	pack: InflectionPack<L, F, string>,
): string {
	const labels = axes.bundles
		.map((bundle) => pack.labels.bundle(bundle).trim())
		.filter((label) => label.length > 0);
	return labels.join(axes.placement.kind === "OneOf" ? " / " : ", ");
}

/**
 * An {@link InflectionHook} from a language's Inflection Pack: the Lemma's
 * view from `projectLemmaTables`, one table per Licence Group drawn by
 * `draw` ({@link drawTable}, the dictionary's line style, by default),
 * each met Surface's Surface Axes through the pack's `labels.bundle`, and
 * a mark on each Surface met as a Licence Conflict. Its `versions` are the
 * ones the view carries: the pack's `version` and the `schemaFor` schema's
 * id and version.
 */
export function inflectionFromPack<L extends Dumling.Language, F>(
	pack: InflectionPack<L, F, string>,
	draw: TableDrawer<L, F> = drawTable,
): InflectionHook<L> {
	const versions = (lemma: Dumling.Lemma<L>): TableVersions => {
		const schema = pack.schemaFor(lemma);
		return {
			pack: pack.version,
			...(schema === undefined
				? {}
				: { schema: { id: schema.id, version: schema.version } }),
		};
	};
	const render: InflectionHook<L> = ({ link, records }) => {
		const view = projectLemmaTables(pack, {
			lemmaRecord: records.lemmaRecord,
			ownedSurfaceEntries: records.ownedSurfaceEntries,
			readingEntries: records.readingEntries,
		});
		const marks = conflictMarks(view, records);
		const { lemma } = records.lemmaRecord;
		return {
			surfaces: view.surfaces.map((line) => ({
				axes: axesOf(line.axes, pack),
				marks: marks.get(line.surfaceId) ?? [],
				surfaceId: line.surfaceId,
			})),
			tables: view.groups.map((group) => ({
				lines: draw({ group, lemma, link, pack, view }),
				readings: group.readings,
				selectionKey: group.selectionKey,
			})),
		};
	};
	return Object.assign(render, { versions });
}
