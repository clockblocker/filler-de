import type { AgentOutput } from "../../../../../prompt-smith";
import type { LemmaResult } from "../../lemma/types";
import { formatHeaderLine as formatCommonHeader } from "./common/header-formatter";
import { formatHeaderLine as formatNounHeader } from "./de/lexem/noun/header-formatter";

type EnrichmentOutput =
	| AgentOutput<"LexemEnrichment">
	| AgentOutput<"PhrasemEnrichment">;

/**
 * Dispatch header formatting by POS.
 * Currently only Noun diverges (prepends article derived from genus).
 */
export function dispatchHeaderFormatter(
	lemmaResult: LemmaResult,
	enrichmentOutput: EnrichmentOutput,
	targetLanguage: string,
): string {
	const output = {
		emojiDescription:
			lemmaResult.precomputedEmojiDescription ??
			enrichmentOutput.emojiDescription,
		ipa: enrichmentOutput.ipa,
	};

	if (
		lemmaResult.linguisticUnit === "Lexem" &&
		enrichmentOutput.linguisticUnit === "Lexem" &&
		lemmaResult.posLikeKind === "Noun" &&
		enrichmentOutput.posLikeKind === "Noun" &&
		enrichmentOutput.genus
	) {
		return formatNounHeader(
			output,
			lemmaResult.lemma,
			targetLanguage,
			enrichmentOutput.genus,
		);
	}

	return formatCommonHeader(output, lemmaResult.lemma, targetLanguage);
}
