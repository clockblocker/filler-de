import { buildGoBackLinkPattern } from "../../go-back-link";
import type { ClipboardCopyEvent } from "../../../../managers/obsidian/user-event-interceptor";
import { META_SECTION_PATTERN } from "../../../../managers/pure/note-metadata-manager";

/**
 * Handle clipboard copy: strip metadata and go-back links from copied text.
 */
export function handleClipboardCopy(event: ClipboardCopyEvent): void {
	const { originalText, preventDefault, setClipboardData } = event;

	const goBackPattern = buildGoBackLinkPattern();
	const withoutGoBack = originalText.replace(goBackPattern, "");
	const withoutMeta = withoutGoBack.replace(META_SECTION_PATTERN, "");

	// Only intercept if we actually stripped metadata/links
	const strippedContent =
		withoutGoBack.length < originalText.length ||
		withoutMeta.length < withoutGoBack.length;

	if (!strippedContent) return; // Let native copy handle it

	preventDefault();
	setClipboardData(withoutMeta.trim());
}
