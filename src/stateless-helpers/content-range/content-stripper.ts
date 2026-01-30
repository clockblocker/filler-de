/**
 * Content stripping for clipboard operations.
 * Removes metadata and navigation links from copied text.
 */

import { goBackLinkHelper } from "../go-back-link";
import { META_SECTION_PATTERN } from "../note-metadata";

/**
 * Strip metadata and go-back links from content for clipboard.
 * Returns the stripped content, or null if no stripping was needed.
 */
export function stripContentForClipboard(text: string): string | null {
	const goBackPattern = goBackLinkHelper.buildPattern();
	const withoutGoBack = text.replace(goBackPattern, "");
	const withoutMeta = withoutGoBack.replace(META_SECTION_PATTERN, "");

	// Only return modified text if we actually stripped something
	const strippedContent =
		withoutGoBack.length < text.length ||
		withoutMeta.length < withoutGoBack.length;

	if (!strippedContent) return null;

	return withoutMeta.trim();
}
