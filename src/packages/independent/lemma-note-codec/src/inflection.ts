import {
	type InflectionPack,
	type LemmaTablesView,
	projectLemmaTables,
	type TableGroupView,
} from "dumdict/inflection";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { tableBlockIds } from "./block-ids";
import type { LinkRenderer } from "./links";
import type { LemmaRecords, SurfaceId } from "./types";

/**
 * Inflection tables (spec: Projections). A Lemma note shows one table per
 * Licence Group, and each Reading note embeds its group's. The codec only
 * lays tables out: an {@link InflectionHook} renders them, normally from
 * `dumdict/inflection`'s `projectLemmaTables` and a language's Inflection
 * Pack ({@link inflectionFromPack}). Until the German pack lands (#120),
 * the plugin's hook wraps its own German projections.
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

/** Renders a Lemma's tables, or undefined when it has none. Pure. */
export type InflectionHook<L extends Dumling.Language> = (
	input: InflectionInput<L>,
) => RenderedInflection<L> | undefined;

/** One Licence Group's table in a note, with its Block ID. */
export type LemmaTable<L extends Dumling.Language> = RenderedTable<L> & {
	readonly blockId: string;
};

export type LemmaTables<L extends Dumling.Language> = {
	readonly tables: readonly LemmaTable<L>[];
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
			(rendered.surfaces ?? []).map(({ axes, surfaceId }) => [
				surfaceId as string,
				axes,
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

/** How {@link inflectionFromPack} draws one group's core panels. */
export type TableDrawer<L extends Dumling.Language, F> = (
	group: TableGroupView<L, F>,
	pack: InflectionPack<L, F, string>,
	view: LemmaTablesView<L, F>,
) => readonly string[];

/**
 * A plain, language-blind drawing of a group's core panels: per panel its
 * label, then one line per row, `<row label>: <cells>`, the cells' forms
 * through the pack's `display` with ` / ` between a cell's forms and `—`
 * for a cell without one. #120 replaces it with the dictionary's tables.
 */
export function drawPanels<L extends Dumling.Language, F>(
	group: TableGroupView<L, F>,
	pack: InflectionPack<L, F, string>,
): readonly string[] {
	const shown = (form: F) =>
		pack
			.display(form)
			.map((run) => run.text)
			.join("");
	return group.panels.flatMap((panel) => {
		const rows = panel.rows.map((row, index) => {
			const cells = (panel.cells[index] ?? []).map((cell) =>
				cell.forms.length === 0
					? "—"
					: cell.forms.map(({ form }) => shown(form)).join(" / "),
			);
			return `${pack.labels.axis(row)}: ${cells.join(", ")}`;
		});
		const label = pack.labels.panel(panel.id).trim();
		return label.length === 0 ? rows : [label, ...rows];
	});
}

/**
 * An {@link InflectionHook} from a language's Inflection Pack: the Lemma's
 * view from `projectLemmaTables`, one table per Licence Group drawn by
 * `draw`, and each met Surface's axes through the pack's `labels.bundle`.
 */
export function inflectionFromPack<L extends Dumling.Language, F>(
	pack: InflectionPack<L, F, string>,
	draw: TableDrawer<L, F> = drawPanels,
): InflectionHook<L> {
	return ({ records }) => {
		const view = projectLemmaTables(pack, {
			lemmaRecord: records.lemmaRecord,
			ownedSurfaceEntries: records.ownedSurfaceEntries,
			readingEntries: records.readingEntries,
		});
		return {
			surfaces: view.surfaces.map((line) => ({
				axes: line.axes.bundles
					.map((bundle) => pack.labels.bundle(bundle))
					.join(", "),
				surfaceId: line.surfaceId,
			})),
			tables: view.groups.map((group) => ({
				lines: draw(group, pack, view),
				readings: group.readings,
				selectionKey: group.selectionKey,
			})),
		};
	};
}
