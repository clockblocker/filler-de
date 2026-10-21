import type {
	CellView,
	DisplayRun,
	FormView,
	InflectionPack,
	LemmaTablesView,
	PanelView,
	TableGroupView,
} from "dumdict/inflection";
import type * as Dumling from "dumling/types";
import type { LinkRenderer } from "../links";

/**
 * The dictionary's inflection tables (spec: Layout, Flexion). A table is
 * drawn in the user's line style, one line per row, `N: die [[Mutter]],
 * die Mütter`, never as a Markdown grid. The drawing is language-blind: it
 * reads the shape of a `LemmaTablesView` group and applies the pack's
 * `labels` and `display`, and it never names a case, a tense or a person.
 */

/** What a {@link TableDrawer} reads to draw one Licence Group's table. */
export type TableDrawContext<L extends Dumling.Language, F> = {
	readonly group: TableGroupView<L, F>;
	readonly pack: InflectionPack<L, F, string>;
	readonly view: LemmaTablesView<L, F>;
	readonly lemma: Dumling.Lemma<L>;
	/** The note's link renderer: a form spelled as the Lemma links it. */
	readonly link: LinkRenderer<L>;
};

/**
 * Draws one Licence Group's core panels as the lines of one Obsidian block:
 * no blank line, no caption and no Block ID, which the codec adds. No
 * lines: the group has no table.
 */
export type TableDrawer<L extends Dumling.Language, F> = (
	context: TableDrawContext<L, F>,
) => readonly string[];

/** A cell no form fills: neither derivation nor a met form gives one. */
const UNKNOWN_CELL = "?";
/** A cell the language, or the group's licensed selection, gives no form. */
const ABSENT_CELL = "—";
/** Between the forms of one cell: `molk / melkte`. */
const FORM_SEPARATOR = " / ";
/** Between the cells of one line. */
const CELL_SEPARATOR = ", ";
/** A Gap run: the break in a discontinuous form, `er fährt … ab`. */
const GAP = " … ";
/** After a met form that is only one of its candidate cells', so maybe not this one's. */
const UNCERTAIN_MARK = " (?)";
/** A panel with more columns than this labels each cell with its column. */
const UNLABELLED_COLUMNS = 2;

const isFilled = (cell: CellView<Dumling.Language, unknown>) =>
	cell.status === "Filled";

/**
 * A form's display runs as text: Context as plain text, a Gap as ` … `,
 * and the Form as plain text, or as a link to the Lemma when the form is
 * one Form run spelled as the Lemma's Canonical Form. A met form only one
 * of whose candidate cells this is gets ` (?)`.
 */
function drawRuns<L extends Dumling.Language, F>(
	runs: readonly DisplayRun[],
	form: FormView<L, F>,
	{ link, lemma }: TableDrawContext<L, F>,
): string {
	const words = runs.filter(({ role }) => role === "Form");
	const linked =
		words.length === 1 && words[0]?.text.trim() === lemma.canonicalForm;
	const text = runs
		.map(({ role, text }) => {
			if (role === "Gap") return GAP;
			if (role === "Context" || !linked) return text;
			const [, before = "", word = "", after = ""] =
				/^(\s*)(.*?)(\s*)$/su.exec(text) ?? [];
			return `${before}${link(
				{ names: { kind: "Lemma", lemma }, role: "inflection" },
				word,
			)}${after}`;
		})
		.join("");
	const uncertain =
		form.derived.length === 0 &&
		form.attested.length > 0 &&
		form.attested.every(({ uncertain }) => uncertain);
	return uncertain ? `${text}${UNCERTAIN_MARK}` : text;
}

/**
 * A cell: `?` when Unknown, `—` when Absent, else its forms with ` / `
 * between them. A leading Context every form shares shows once:
 * `du melkst / milkst`, not `du melkst / du milkst`.
 */
function drawCell<L extends Dumling.Language, F>(
	cell: CellView<L, F>,
	context: TableDrawContext<L, F>,
): string {
	if (cell.status === "Absent") return ABSENT_CELL;
	if (cell.status === "Unknown" || cell.forms.length === 0)
		return UNKNOWN_CELL;
	const displayed = cell.forms.map((form) => ({
		form,
		runs: context.pack.display(form.form),
	}));
	const [first] = displayed;
	const shared =
		displayed.length > 1 &&
		first?.runs[0]?.role === "Context" &&
		displayed.every(
			({ runs }) =>
				runs.length > 1 &&
				runs[0]?.role === "Context" &&
				runs[0].text === first.runs[0]?.text,
		)
			? first.runs[0].text
			: undefined;
	const forms = displayed
		.map(({ form, runs }) =>
			drawRuns(
				shared === undefined ? runs : runs.slice(1),
				form,
				context,
			),
		)
		.join(FORM_SEPARATOR);
	return shared === undefined ? forms : `${shared}${forms}`;
}

/** `label: cells`, or the cells alone under an empty label. */
const line = (label: string, cells: readonly string[]) => {
	const shown = cells.join(CELL_SEPARATOR);
	return label.length === 0 ? shown : `${label}: ${shown}`;
};

/**
 * One panel's lines. A column that is Absent in every row is left out, and
 * so is a row with no Filled cell. In a table of several panels, a
 * single-column panel is one line under its own label, its rows' cells in row order: the display's
 * Context tells the rows apart (`ich fahre, du fährst, …`).
 */
function drawPanel<L extends Dumling.Language, F>(
	panel: PanelView<L, F>,
	context: TableDrawContext<L, F>,
	multiPanel: boolean,
): string[] {
	const { labels } = context.pack;
	const columns = panel.columns
		.map((bundle, index) => ({ bundle, index }))
		.filter(({ index }) =>
			panel.cells.some((row) => row[index]?.status !== "Absent"),
		);
	if (columns.length === 0) return [];
	const label = labels.panel(panel.id).trim();
	const cellsOf = (row: number) =>
		columns.flatMap(({ index }) => panel.cells[row]?.[index] ?? []);
	if (multiPanel && columns.length === 1) {
		const cells = panel.rows
			.flatMap((_, row) => cellsOf(row))
			.filter(({ status }) => status !== "Absent");
		if (!cells.some(isFilled)) return [];
		return [
			line(
				label,
				cells.map((cell) => drawCell(cell, context)),
			),
		];
	}
	const labelled = columns.length > UNLABELLED_COLUMNS;
	const rows = panel.rows.flatMap((bundle, row) => {
		const cells = cellsOf(row);
		if (!cells.some(isFilled)) return [];
		return [
			line(
				labels.axis(bundle).trim(),
				cells.map((cell, position) => {
					const shown = drawCell(cell, context);
					const column = columns[position];
					if (!labelled || column === undefined) return shown;
					const heading = labels.axis(column.bundle).trim();
					return heading.length === 0
						? shown
						: `${shown} (${heading})`;
				}),
			),
		];
	});
	if (rows.length === 0) return [];
	return multiPanel && label.length > 0 ? [label, ...rows] : rows;
}

/**
 * The dictionary's {@link TableDrawer}, in the user's line style:
 *
 * - **One panel** (a noun's declension, a comparison): one line per row,
 *   `<row label>: <cells>`, and no panel caption.
 * - **Several panels** (a verb's tenses): a single-column panel is one
 *   line, `<panel label>: <its rows' cells>`; any other panel is its label
 *   on a line of its own, then its rows.
 * - **Cells** are in column order, `, ` between them; a panel with more than
 *   two columns follows each cell with its column label, `dieser (m)`.
 * - **Forms** show their display runs: Context as plain text, a Gap as
 *   ` … `, ` / ` between a cell's forms (`er melkte / molk`), a leading
 *   Context they all share shown once. A form spelled as the Lemma links
 *   the Lemma note; every other form is plain text.
 * - **Holes**: an Unknown cell is `?`, an Absent one `—`, and a met form
 *   that is only one of its candidate cells' gets ` (?)`. A row with no
 *   form, and a column Absent in every row, are left out.
 */
export function drawTable<L extends Dumling.Language, F>(
	context: TableDrawContext<L, F>,
): readonly string[] {
	const { panels } = context.group;
	const multiPanel = panels.length > 1;
	return panels.flatMap((panel) => drawPanel(panel, context, multiPanel));
}
