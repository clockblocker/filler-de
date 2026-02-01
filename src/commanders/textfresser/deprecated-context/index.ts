/**
 * TextfresserContext module - builds structured context from wikilink clicks.
 */

import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../stateless-helpers/markdown-strip";
import {
	type ParsedWikilink,
	wikilinkHelper,
} from "../../../stateless-helpers/wikilink";

// Backwards-compatible re-exports using new API
export const extractBlockIdFromLine = blockIdHelper.extractFromLine;
export const findClickedWikilink = wikilinkHelper.findByTarget;
export const parseWikilinks = wikilinkHelper.parse;
export const replaceWikilinksWithSurface = markdownHelper.replaceWikilinks;
export const stripBlockRefs = markdownHelper.stripBlockRefs;
export const stripMarkdownForContext = markdownHelper.stripAll;

export type { ParsedWikilink };

export {
	buildTextfresserContext,
	type ContextBuilderInput,
} from "./context-builder";
export type {
	ContextError,
	TargetMatchesLemma,
	TextfresserContext,
} from "./types";
export { noClickError, wikilinkNotFoundError } from "./types";
