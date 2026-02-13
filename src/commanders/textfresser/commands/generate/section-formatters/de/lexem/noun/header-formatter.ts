import {
	articleFromGenus,
	type GermanGenus,
} from "../../../../../../../../linguistics/de/lexem/noun/features";
import { buildYouglishUrl } from "../../../common/header-formatter";

/**
 * Noun-specific header: `{emoji} {article} [[{lemma}]], [{ipa}](youglish_url)`
 *
 * `genus` is non-optional — pipeline guarantees it for nouns.
 */
export function formatHeaderLine(
	output: { emojiDescription: string[]; ipa: string },
	lemma: string,
	targetLanguage: string,
	genus: GermanGenus,
): string {
	const emoji = output.emojiDescription[0];
	const article = articleFromGenus[genus];
	const youglishUrl = buildYouglishUrl(lemma, targetLanguage);

	return `${emoji} ${article} [[${lemma}]], [${output.ipa}](${youglishUrl})`;
}
