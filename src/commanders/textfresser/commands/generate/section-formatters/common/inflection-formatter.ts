import type { LexemeInflections } from "@textfresser/lexical-generation";
import { wikilinkHelper } from "@textfresser/note-addressing/wikilink";

type GenericInflectionSectionInput = {
	rows: Array<{
		forms:
			| string
			| Extract<
					LexemeInflections,
					{ kind: "generic" }
			  >["rows"][number]["forms"];
		label: string;
	}>;
};

/**
 * Format LLM inflection output into markdown lines.
 * Each line: `{label}: {forms}`
 *
 * Example output:
 *   N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]
 *   A: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]
 *   G: des [[Kohlekraftwerkes]], der [[Kohlekraftwerke]]
 *   D: dem [[Kohlekraftwerk]], den [[Kohlekraftwerken]]
 */
export function formatInflectionSection(
	output: GenericInflectionSectionInput,
): string {
	return output.rows
		.map((row) => {
			const normalizedForms =
				typeof row.forms === "string"
					? wikilinkHelper.normalizeWikilinkTargetsInText(row.forms)
					: row.forms
							.map(
								(form) =>
									`[[${wikilinkHelper.normalizeLinkTarget(form.form)}]]`,
							)
							.join(", ");
			return `${row.label}: ${normalizedForms}`;
		})
		.join("\n");
}
