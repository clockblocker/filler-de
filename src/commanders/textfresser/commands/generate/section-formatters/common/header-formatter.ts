import { wikilinkHelper } from "@textfresser/note-addressing";

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
 * Emoji sequence is derived from senseEmojis in order.
 */
export function formatHeaderLine(
	output: { senseEmojis: string[]; ipa: string },
	lemma: string,
	targetLanguage: string,
): string {
	const emoji = output.senseEmojis.join(" ");
	const normalizedLemma = wikilinkHelper.normalizeLinkTarget(lemma);
	const youglishUrl = buildYouglishUrl(normalizedLemma, targetLanguage);

	return `${emoji} [[${normalizedLemma}]], [${output.ipa}](${youglishUrl})`;
}
