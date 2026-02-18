import type { GermanGenus } from "../../../../../linguistics/de";
import type { AgentOutput } from "../../../../../prompt-smith";
import type { LemmaResult } from "../../lemma/types";
import { formatHeaderLine as formatCommonHeader } from "./common/header-formatter";
import { formatHeaderLine as formatNounHeader } from "./de/lexem/noun/header-formatter";

type EnrichmentOutput =
	| AgentOutput<"LexemEnrichment">
	| AgentOutput<"NounEnrichment">
	| AgentOutput<"PhrasemEnrichment">;

/**
 * Dispatch header formatting by POS.
 * Currently only Noun diverges (prepends article derived from genus).
 */
export function dispatchHeaderFormatter(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
	targetLanguage: string,
	fallbackNounGenus?: GermanGenus,
): string {
	const output = {
		emojiDescription:
			lemmaResult.precomputedEmojiDescription ??
			enrichmentOutput.emojiDescription,
		ipa: enrichmentOutput.ipa,
	};

	if (
		lemmaResult.linguisticUnit === "Lexem" &&
		lemmaResult.posLikeKind === "Noun"
	) {
		// NounEnrichment is strict and the only enrichment shape that carries genus.
		const resolvedNounGenus =
			"genus" in enrichmentOutput
				? (enrichmentOutput.genus ?? fallbackNounGenus)
				: fallbackNounGenus;
		if (resolvedNounGenus) {
			return formatNounHeader(
				output,
				lemmaResult.lemma,
				targetLanguage,
				resolvedNounGenus,
			);
		}
	}

	return formatCommonHeader(output, lemmaResult.lemma, targetLanguage);
}
