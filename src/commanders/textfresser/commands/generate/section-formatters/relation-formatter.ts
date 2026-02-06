import type { AgentOutput } from "../../../../../prompt-smith";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";

const SYMBOL_FOR_KIND: Record<RelationSubKind, string> = {
	Antonym: "≠",
	Holonym: "∋",
	Hypernym: "⊃",
	Hyponym: "⊂",
	Meronym: "∈",
	NearSynonym: "≈",
	Synonym: "=",
};

/**
 * Format LLM relation output into markdown lines.
 * Each line: `{symbol} [[word1]], [[word2]]`
 */
export function formatRelationSection(output: AgentOutput<"Relation">): string {
	return output.relations
		.map((r) => {
			const symbol = SYMBOL_FOR_KIND[r.kind];
			const words = r.words.map((w) => `[[${w}]]`).join(", ");
			return `${symbol} ${words}`;
		})
		.join("\n");
}
