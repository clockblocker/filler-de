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
	const youglishUrl = buildYouglishUrl(lemma, targetLanguage);

	return `${emoji} [[${lemma}]], [${output.ipa}](${youglishUrl})`;
}
