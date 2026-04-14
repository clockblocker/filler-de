import { wikilinkHelper } from "@textfresser/note-addressing";
import {
	ARTICLE_BY_GENUS,
	type LexicalGenus,
} from "../../../../../../domain/lexical-types";
import { buildYouglishUrl } from "../../../common/header-formatter";

/**
 * Noun-specific header: `{emoji} {article} [[{lemma}]], [{ipa}](youglish_url)`
 *
 * `genus` is non-optional — pipeline guarantees it for nouns.
 */
export function formatHeaderLine(
	output: { senseEmojis: string[]; ipa: string },
	lemma: string,
	targetLanguage: string,
	genus: LexicalGenus,
): string {
	const emoji = output.senseEmojis.join(" ");
	const article = ARTICLE_BY_GENUS[genus];
	const normalizedLemma = wikilinkHelper.normalizeLinkTarget(lemma);
	const youglishUrl = buildYouglishUrl(normalizedLemma, targetLanguage);

	return `${emoji} ${article} [[${normalizedLemma}]], [${output.ipa}](${youglishUrl})`;
}
