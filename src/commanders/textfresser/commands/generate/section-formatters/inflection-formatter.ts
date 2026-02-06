import type { AgentOutput } from "../../../../../prompt-smith";

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
	output: AgentOutput<"Inflection">,
): string {
	return output.rows.map((r) => `${r.label}: ${r.forms}`).join("\n");
}
