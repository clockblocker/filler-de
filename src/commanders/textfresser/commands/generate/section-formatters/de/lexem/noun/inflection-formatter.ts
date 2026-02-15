import type { CaseValue } from "../../../../../../../../linguistics/common/enums/inflection/feature-values";
import {
	CASE_ORDER,
	CASE_SHORT_LABEL,
	type NounInflectionCell,
} from "../../../../../../../../linguistics/de/lexem/noun";
import type { AgentOutput } from "../../../../../../../../prompt-smith";

/**
 * Group cells by case, then format each case line as:
 *   N: das [[Kraftwerk]], die [[Kraftwerke]]
 *
 * Returns both the formatted section string and the raw cells for propagation.
 */
export function formatInflection(output: AgentOutput<"NounInflection">): {
	formattedSection: string;
	cells: NounInflectionCell[];
} {
	const cells: NounInflectionCell[] = output.cells.map((c) => ({
		article: c.article,
		case: c.case,
		form: c.form,
		number: c.number,
	}));

	// Group cells by case
	const byCase = new Map<CaseValue, NounInflectionCell[]>();
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
		const forms = group.map((c) => `${c.article} [[${c.form}]]`).join(", ");
		lines.push(`${label}: ${forms}`);
	}

	return { cells, formattedSection: lines.join("\n") };
}
