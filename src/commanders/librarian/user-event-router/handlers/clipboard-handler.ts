import type { ClipboardPayload } from "../../../../managers/obsidian/user-event-interceptor";
import { META_SECTION_PATTERN } from "../../../../managers/pure/note-metadata-manager";
import { buildGoBackLinkPattern } from "../../go-back-link";

/**
 * Handle clipboard copy: strip metadata and go-back links from copied text.
 * Returns modified payload if text was stripped, null if no changes needed.
 */
export function handleClipboardCopy(
	payload: ClipboardPayload,
): ClipboardPayload | null {
	const { originalText } = payload;

	const goBackPattern = buildGoBackLinkPattern();
	const withoutGoBack = originalText.replace(goBackPattern, "");
	const withoutMeta = withoutGoBack.replace(META_SECTION_PATTERN, "");

	// Only intercept if we actually stripped metadata/links
	const strippedContent =
		withoutGoBack.length < originalText.length ||
		withoutMeta.length < withoutGoBack.length;

	if (!strippedContent) return null; // No changes needed

	return {
		...payload,
		modifiedText: withoutMeta.trim(),
	};
}
