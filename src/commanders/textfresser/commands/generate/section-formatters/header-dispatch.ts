import type { LemmaResult } from "../../lemma/types";
import { formatHeaderLine as formatCommonHeader } from "./common/header-formatter";
import { formatHeaderLine as formatNounHeader } from "./de/lexem/noun/header-formatter";

/**
 * Dispatch header formatting by POS.
 * Currently only Noun diverges (prepends article derived from genus).
 */
export function dispatchHeaderFormatter(
	lemmaResult: LemmaResult,
	targetLanguage: string,
): string {
	const output = {
		emojiDescription:
			lemmaResult.precomputedEmojiDescription ??
			lemmaResult.emojiDescription,
		ipa: lemmaResult.ipa,
	};

	if (lemmaResult.pos === "Noun" && lemmaResult.genus) {
		return formatNounHeader(
			output,
			lemmaResult.lemma,
			targetLanguage,
			lemmaResult.genus,
		);
	}

	return formatCommonHeader(output, lemmaResult.lemma, targetLanguage);
}
