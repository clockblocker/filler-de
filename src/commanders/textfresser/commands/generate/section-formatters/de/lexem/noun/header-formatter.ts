import {
	articleFromGenus,
	type GermanGenus,
} from "../../../../../../../../linguistics/de/lexem/noun/features";
import { wikilinkHelper } from "../../../../../../../../stateless-helpers/wikilink";
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
	const emoji = output.emojiDescription.join(" ");
	const article = articleFromGenus[genus];
	const normalizedLemma = wikilinkHelper.normalizeLinkTarget(lemma);
	const youglishUrl = buildYouglishUrl(normalizedLemma, targetLanguage);

	return `${emoji} ${article} [[${normalizedLemma}]], [${output.ipa}](${youglishUrl})`;
}
