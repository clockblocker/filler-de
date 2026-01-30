/**
 * Build TextfresserContext from wikilink click data.
 */

import { err, ok, type Result } from "neverthrow";
import {
	blockIdHelper,
	markdown,
	wikilinkHelper,
} from "../../../stateless-helpers/pure-formatting-utils";
import {
	type ContextError,
	type TextfresserContext,
	wikilinkNotFoundError,
} from "./types";

export type ContextBuilderInput = {
	/** Full line/block content where link is located */
	blockContent: string;
	/** Link target - the [[target]] content */
	linkTarget: string;
	/** Basename of the file (for block embed formatting) */
	basename: string;
};

/**
 * Build TextfresserContext from input data.
 * @param input - The wikilink click input data
 * @returns Result with TextfresserContext or ContextError
 */
export function buildTextfresserContext(
	input: ContextBuilderInput,
): Result<TextfresserContext, ContextError> {
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
		targetMatchesBaseform: "Unverified",
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
	const stripped = markdown.stripAll(blockContent);

	// Replace the target surface with highlighted version
	// Only replace first occurrence to avoid double-highlighting
	return stripped.replace(targetSurface, `[${targetSurface}]`);
}
