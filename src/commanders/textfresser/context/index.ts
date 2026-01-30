/**
 * TextfresserContext module - builds structured context from wikilink clicks.
 */

// Re-export from pure-formatting-utils for backwards compatibility
import {
	blockIdHelper,
	markdown,
	type ParsedWikilink,
	wikilinkHelper,
} from "../../../stateless-services/pure-formatting-utils";

// Backwards-compatible re-exports using new API
export const extractBlockIdFromLine = blockIdHelper.extractFromLine;
export const findClickedWikilink = wikilinkHelper.findByTarget;
export const parseWikilinks = wikilinkHelper.parse;
export const replaceWikilinksWithSurface = markdown.replaceWikilinks;
export const stripBlockRefs = markdown.stripBlockRefs;
export const stripBoldMarkers = markdown.stripBold;
export const stripMarkdownForContext = markdown.stripAll;

export type { ParsedWikilink };

export {
	buildTextfresserContext,
	type ContextBuilderInput,
} from "./context-builder";
export type {
	ContextError,
	TargetMatchesBaseform,
	TextfresserContext,
} from "./types";
export { noClickError, wikilinkNotFoundError } from "./types";
