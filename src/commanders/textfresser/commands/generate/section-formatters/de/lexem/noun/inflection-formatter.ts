import type {
	LexemInflections,
	LexicalCase,
} from "../../../../../../../../lexical-generation";
import { wikilinkHelper } from "../../../../../../../../stateless-helpers/wikilink";
import {
	CASE_ORDER,
	CASE_SHORT_LABEL,
	type TextfresserNounInflectionCell,
} from "../../../../../../domain/lexical-types";

/**
 * Group cells by case, then format each case line as:
 *   N: das [[Kraftwerk]], die [[Kraftwerke]]
 *
 * Returns both the formatted section string and the raw cells for propagation.
 */
export function formatInflection(
	output: Extract<LexemInflections, { kind: "noun" }>,
): {
	formattedSection: string;
	cells: TextfresserNounInflectionCell[];
} {
	const cells: TextfresserNounInflectionCell[] = output.cells.map((c) => ({
		article: c.article,
		case: c.case,
		form: wikilinkHelper.normalizeLinkTarget(c.form),
		number: c.number,
	}));

	// Group cells by case
	const byCase = new Map<LexicalCase, TextfresserNounInflectionCell[]>();
	for (const cell of cells) {
		const group = byCase.get(cell.case) ?? [];
		group.push(cell);
		byCase.set(cell.case, group);
	}

	const lines: string[] = [];
	for (const caseVal of CASE_ORDER) {
		const group = byCase.get(caseVal);
		if (!group || group.length === 0) continue;

		const label = CASE_SHORT_LABEL[caseVal];
		const forms = group
			.map((cell) => `${cell.article} [[${cell.form}]]`)
			.join(", ");
		lines.push(`${label}: ${forms}`);
	}

	return { cells, formattedSection: lines.join("\n") };
}
