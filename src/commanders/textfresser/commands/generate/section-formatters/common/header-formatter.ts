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
 * Emoji is derived from emojiDescription[0].
 */
export function formatHeaderLine(
	output: { emojiDescription: string[]; ipa: string },
	lemma: string,
	targetLanguage: string,
): string {
	const emoji = output.emojiDescription[0];
	const youglishUrl = buildYouglishUrl(lemma, targetLanguage);

	return `${emoji} [[${lemma}]], [${output.ipa}](${youglishUrl})`;
}
