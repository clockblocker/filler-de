import type { LexicalRelations } from "@textfresser/lexical-generation";
import { wikilinkHelper } from "../../../../../../stateless-helpers/wikilink";

const SYMBOL_FOR_KIND: Record<
	LexicalRelations["relations"][number]["kind"],
	string
> = {
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
export function formatRelationSection(output: LexicalRelations): string {
	return output.relations
		.map((r) => {
			const symbol = SYMBOL_FOR_KIND[r.kind];
			const words = r.words
				.map(
					(word) => `[[${wikilinkHelper.normalizeLinkTarget(word)}]]`,
				)
				.join(", ");
			return `${symbol} ${words}`;
		})
		.join("\n");
}
