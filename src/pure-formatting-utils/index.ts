/**
 * Pure formatting utilities for block IDs, wikilinks, and markdown.
 * No Obsidian dependencies - can be used in any context.
 */

// Block ID utilities
export {
	BLOCK_ID_PATTERN,
	extractBlockIdFromLine,
	extractNumericBlockId,
	findHighestBlockNumber,
} from "./block-id";

// Block embed formatting
export { formatBlockEmbed } from "./block-embed";

// Wikilink parsing
export {
	type ParsedWikilink,
	WIKILINK_REGEX,
	findClickedWikilink,
	findWikilinkByTarget,
	parseWikilinks,
} from "./wikilink";

// Markdown stripping
export {
	replaceWikilinksWithSurface,
	stripBlockRefs,
	stripBoldMarkers,
	stripMarkdownForContext,
} from "./markdown-strip";
