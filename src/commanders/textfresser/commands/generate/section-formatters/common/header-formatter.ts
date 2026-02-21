import { wikilinkHelper } from "../../../../../../stateless-helpers/wikilink";

const YOUGLISH_BASE = "https://youglish.com/pronounce";

export function buildYouglishUrl(
	lemma: string,
	targetLanguage: string,
): string {
	return `${YOUGLISH_BASE}/${encodeURIComponent(lemma)}/${targetLanguage.toLowerCase()}`;
}

/**
 * Format header line from Lemma output fields.
 * Format: `{emoji} [[{lemma}]], [{ipa}](youglish_url)`
 *
 * Emoji sequence is derived from emojiDescription in order.
 */
export function formatHeaderLine(
	output: { emojiDescription: string[]; ipa: string },
	lemma: string,
	targetLanguage: string,
): string {
	const emoji = output.emojiDescription.join(" ");
	const normalizedLemma = wikilinkHelper.normalizeLinkTarget(lemma);
	const youglishUrl = buildYouglishUrl(normalizedLemma, targetLanguage);

	return `${emoji} [[${normalizedLemma}]], [${output.ipa}](${youglishUrl})`;
}
