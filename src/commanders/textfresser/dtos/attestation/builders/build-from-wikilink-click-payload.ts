/**
 * Build Attestation from wikilink click data.
 */

import { err, ok, type Result } from "neverthrow";
import type { WikilinkClickPayload } from "../../../../../managers/obsidian/user-event-interceptor/events";

/**
 * Build Attestation from input data.
 * @param input - The wikilink click input data
 * @returns Result with Attestation or ContextError
 */
export function buildAttestation(
	input: WikilinkClickPayload,
): Result<Attestation, ContextError> {
	const { blockContent, linkTarget, basename } = input;

	// Find the clicked wikilink
	const parsedWikilink = wikilinkHelper.findByTarget(
		blockContent,
		linkTarget,
	);
	if (!parsedWikilink) {
		return err(wikilinkNotFoundError());
	}

	// Extract block ID if present
	const extractedBlockId = blockIdHelper.extractFromLine(blockContent);

	// The target is the surface (alias if exists, else link target)
	const target = parsedWikilink.surface;

	// Format the context: block embed if block ID exists, else raw block
	const formattedContext = extractedBlockId
		? blockIdHelper.formatEmbed(basename, extractedBlockId)
		: blockContent;

	// Build the highlighted context: strip markdown, highlight target
	const contextWithOnlyTargetSurfaceHighlited = buildHighlightedContext(
		blockContent,
		parsedWikilink.surface,
	);

	return ok({
		contextWithOnlyTargetSurfaceHighlited,
		formattedContext,
		rawBlock: blockContent,
		target,
		targetMatchesLemma: "Unverified",
	});
}

/**
 * Build context with only the target surface highlighted.
 * Strips markdown formatting and wraps the target surface in [brackets].
 */
function buildHighlightedContext(
	blockContent: string,
	targetSurface: string,
): string {
	// First strip markdown (bold, block refs, wikilinks → surface)
	const stripped = markdownHelper.stripAll(blockContent);

	// Replace the target surface with highlighted version
	// Only replace first occurrence to avoid double-highlighting
	return stripped.replace(targetSurface, `[${targetSurface}]`);
}
