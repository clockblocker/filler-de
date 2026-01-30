/**
 * Build TextfresserContext from wikilink click data.
 */

import { err, ok, type Result } from "neverthrow";
import {
	extractBlockIdFromLine,
	findClickedWikilink,
	formatBlockEmbed,
	stripMarkdownForContext,
} from "../../../pure-formatting-utils";
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
	const wikilink = findClickedWikilink(blockContent, linkTarget);
	if (!wikilink) {
		return err(wikilinkNotFoundError());
	}

	// Extract block ID if present
	const blockId = extractBlockIdFromLine(blockContent);

	// The target is the surface (alias if exists, else link target)
	const target = wikilink.surface;

	// Format the context: block embed if block ID exists, else raw block
	const formattedContext = blockId
		? formatBlockEmbed(basename, blockId)
		: blockContent;

	// Build the highlighted context: strip markdown, highlight target
	const contextWithOnlyTargetSurfaceHighlited = buildHighlightedContext(
		blockContent,
		wikilink.surface,
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
	const stripped = stripMarkdownForContext(blockContent);

	// Replace the target surface with highlighted version
	// Only replace first occurrence to avoid double-highlighting
	return stripped.replace(targetSurface, `[${targetSurface}]`);
}
