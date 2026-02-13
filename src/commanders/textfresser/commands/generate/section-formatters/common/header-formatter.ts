const YOUGLISH_BASE = "https://youglish.com/pronounce";

/**
 * Format header line from Lemma output fields.
 * Format: `{emoji} [[{lemma}]], [{ipa}](youglish_url)`
 * For nouns with article: `{emoji} {article} [[{lemma}]], [{ipa}](youglish_url)`
 *
 * Emoji is derived from emojiDescription[0].
 */
export function formatHeaderLine(
	output: { emojiDescription: string[]; ipa: string },
	lemma: string,
	targetLanguage: string,
	article?: string,
): string {
	const emoji = output.emojiDescription[0];
	const youglishUrl = `${YOUGLISH_BASE}/${encodeURIComponent(lemma)}/${targetLanguage.toLowerCase()}`;
	const lemmaDisplay = article ? `${article} [[${lemma}]]` : `[[${lemma}]]`;

	return `${emoji} ${lemmaDisplay}, [${output.ipa}](${youglishUrl})`;
}
