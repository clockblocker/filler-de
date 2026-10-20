/** One labelled line of a derived table: `G: des Tages, der Tage`. */
export type TableRow = {
	readonly label: string;
	readonly cells: readonly string[];
};

/**
 * A derived inflection table. Its cells are display-only: they are never
 * Surfaces or members of the Lemma (batteries ADR 0019).
 */
export type InflectionTable = {
	readonly rows: readonly TableRow[];
};

/** The table as Markdown lines, one row per line; undefined when empty. */
export function renderTable(
	table: InflectionTable | undefined,
): string | undefined {
	const rows = table?.rows.filter((row) => row.cells.length > 0) ?? [];
	if (rows.length === 0) return undefined;
	return rows
		.map((row) => `${row.label}: ${row.cells.join(", ")}`)
		.join("\n");
}

/** Each value once, in first-seen order. */
export function distinct(values: readonly string[]): string[] {
	return [...new Set(values)];
}
