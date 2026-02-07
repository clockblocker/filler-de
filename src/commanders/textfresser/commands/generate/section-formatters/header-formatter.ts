import { articleFromGenus } from "../../../../../linguistics/german/enums/genus";
import type { AgentOutput } from "../../../../../prompt-smith";

const YOUGLISH_BASE = "https://youglish.com/pronounce";

/**
 * Format LLM header output into a dictionary header line.
 * Format: `{emoji} {article} [[{lemma}]], [{ipa} ♫](youglish_url)`
 */
export function formatHeaderLine(
	output: AgentOutput<"Header">,
	lemma: string,
	targetLanguage: string,
): string {
	const parts: string[] = [output.emoji];

	if (output.genus) {
		parts.push(articleFromGenus[output.genus]);
	}

	parts.push(`[[${lemma}]],`);

	const youglishUrl = `${YOUGLISH_BASE}/${encodeURIComponent(lemma)}/${targetLanguage.toLowerCase()}`;
	parts.push(`[${output.ipa} ♫](${youglishUrl})`);

	return parts.join(" ");
}
