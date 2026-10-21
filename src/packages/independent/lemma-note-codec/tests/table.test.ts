import { describe, expect, it } from "bun:test";
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
import { drawTable, type LinkSubject } from "../src";
import { mutter } from "./fixtures";

/**
 * The dictionary's table drawer on hand-built views: it reads only the
 * view's shape and the pack's `labels` and `display`, never a case or a
 * tense.
 */

type Form = readonly DisplayRun[];
type De = "de";

const pack = {
	display: (form: Form) => form,
	labels: {
		axis: (bundle: Dumling.FeatureBundle) =>
			Object.values(bundle).join("."),
		bundle: (bundle: Dumling.FeatureBundle) =>
			Object.values(bundle).join("."),
		panel: (id: string) => id.toUpperCase(),
	},
} as unknown as InflectionPack<De, Form, string>;

const context = (text: string): DisplayRun => ({ role: "Context", text });
const word = (text: string): DisplayRun => ({ role: "Form", text });
const gap: DisplayRun = { role: "Gap", text: " … " };

const derived = (...runs: DisplayRun[]): FormView<De, Form> => ({
	attested: [],
	derived: [{ provenance: "Rule" }],
	form: runs,
	key: runs.map(({ text }) => text).join(""),
});

/** A met form that is only OneOf its candidate cells. */
const uncertain = (...runs: DisplayRun[]): FormView<De, Form> => ({
	attested: [
		{
			refs: ["r"],
			surfaceId: "s" as never,
			uncertain: true,
		},
	],
	derived: [],
	form: runs,
	key: runs.map(({ text }) => text).join(""),
});

const filled = (...forms: FormView<De, Form>[]): CellView<De, Form> => ({
	forms,
	key: "k" as Dumling.CellKey,
	status: "Filled",
	undescribed: false,
});
const unknown: CellView<De, Form> = {
	forms: [],
	key: "k" as Dumling.CellKey,
	status: "Unknown",
	undescribed: false,
};
const absent: CellView<De, Form> = { ...unknown, status: "Absent" };

const panel = (
	id: string,
	rows: readonly string[],
	columns: readonly string[],
	cells: readonly (readonly CellView<De, Form>[])[],
): PanelView<De, Form> => ({
	cells,
	columns: columns.map(
		(column): Dumling.FeatureBundle => (column === "" ? {} : { column }),
	),
	fixed: {},
	id,
	rows: rows.map((row) => ({ row })),
});

const subjects: LinkSubject[] = [];
function draw(...panels: PanelView<De, Form>[]): readonly string[] {
	const group = {
		panels,
		readingKeys: [],
		readings: [],
		selection: {},
		selectionKey: "[]",
	} as TableGroupView<De, Form>;
	return drawTable({
		group,
		lemma: mutter,
		link: (subject, alias) => {
			subjects.push(subject);
			return `[[${alias}]]`;
		},
		pack,
		view: {} as LemmaTablesView<De, Form>,
	});
}

describe("the dictionary's table drawer", () => {
	it("draws one panel as one line per row, uncaptioned, the Lemma's own form linked", () => {
		expect(
			draw(
				panel(
					"declension",
					["N", "D"],
					["Sg", "Pl"],
					[
						[
							filled(derived(context("die "), word("Mutter"))),
							filled(derived(context("die "), word("Mütter"))),
						],
						[
							filled(derived(context("der "), word("Mutter"))),
							filled(derived(context("den "), word("Müttern"))),
						],
					],
				),
			),
		).toEqual([
			"N: die [[Mutter]], die Mütter",
			"D: der [[Mutter]], den Müttern",
		]);
		expect(subjects.at(-1)).toEqual({
			names: { kind: "Lemma", lemma: mutter },
			role: "inflection",
		});
	});

	it("draws a single-column panel of several as one captioned line, a Gap as …", () => {
		expect(
			draw(
				panel(
					"present",
					["1", "3"],
					[""],
					[
						[
							filled(
								derived(
									context("ich "),
									word("fahre"),
									gap,
									word("ab"),
								),
							),
						],
						[
							filled(
								derived(
									context("er "),
									word("fährt"),
									gap,
									word("ab"),
								),
							),
						],
					],
				),
				panel(
					"participle",
					["Past"],
					[""],
					[[filled(derived(word("abgefahren")))]],
				),
			),
		).toEqual([
			"PRESENT: ich fahre … ab, er fährt … ab",
			"PARTICIPLE: abgefahren",
		]);
	});

	it("captions a multi-column panel of several on its own line", () => {
		expect(
			draw(
				panel("one", ["a"], [""], [[filled(derived(word("x")))]]),
				panel(
					"grid",
					["a", "b"],
					["Sg", "Pl"],
					[
						[
							filled(derived(word("y"))),
							filled(derived(word("z"))),
						],
						[
							filled(derived(word("v"))),
							filled(derived(word("w"))),
						],
					],
				),
			),
		).toEqual(["ONE: x", "GRID", "a: y, z", "b: v, w"]);
	});

	it("joins a cell's forms with /, its shared Context once", () => {
		expect(
			draw(
				panel(
					"preterite",
					["3"],
					[""],
					[
						[
							filled(
								derived(context("er "), word("melkte")),
								derived(context("er "), word("molk")),
							),
						],
					],
				),
			),
		).toEqual(["3: er melkte / molk"]);
	});

	it("labels the cells of a panel with more than two columns", () => {
		expect(
			draw(
				panel(
					"declension",
					["N"],
					["m", "n", "f", "Pl"],
					[
						[
							filled(derived(word("dieser"))),
							filled(derived(word("dieses"))),
							filled(derived(word("diese"))),
							filled(derived(word("diese"))),
						],
					],
				),
			),
		).toEqual(["N: dieser (m), dieses (n), diese (f), diese (Pl)"]);
	});

	it("draws an Unknown cell as ?, an Absent one as —, an uncertain met form with (?)", () => {
		expect(
			draw(
				panel(
					"declension",
					["N", "D"],
					["Sg", "Pl"],
					[
						[filled(derived(word("Obst"))), absent],
						[unknown, filled(uncertain(word("Obsten")))],
					],
				),
			),
		).toEqual(["N: Obst, —", "D: ?, Obsten (?)"]);
	});

	it("leaves out a row with no form, a column Absent in every row and an empty panel", () => {
		expect(
			draw(
				panel(
					"declension",
					["N", "A", "G"],
					["Sg", "Pl"],
					[
						[filled(derived(word("Obst"))), absent],
						[unknown, absent],
						[filled(derived(word("Obstes"))), absent],
					],
				),
			),
		).toEqual(["N: Obst", "G: Obstes"]);
		expect(
			draw(
				panel("present", ["1"], [""], [[unknown]]),
				panel(
					"participle",
					["Past"],
					[""],
					[[filled(derived(word("gesehen")))]],
				),
			),
		).toEqual(["PARTICIPLE: gesehen"]);
		expect(draw(panel("present", ["1"], [""], [[unknown]]))).toEqual([]);
	});
});
