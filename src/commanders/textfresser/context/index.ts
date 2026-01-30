/**
 * TextfresserContext module - builds structured context from wikilink clicks.
 */

export { extractBlockIdFromLine } from "./block-id-extractor";
export {
	type ContextBuilderInput,
	buildTextfresserContext,
} from "./context-builder";
export {
	replaceWikilinksWithSurface,
	stripBlockRefs,
	stripBoldMarkers,
	stripMarkdownForContext,
} from "./markdown-stripper";
export type {
	ContextError,
	TargetMatchesBaseform,
	TextfresserContext,
} from "./types";
export { noClickError, wikilinkNotFoundError } from "./types";
export {
	type ParsedWikilink,
	findClickedWikilink,
	parseWikilinks,
} from "./wikilink-parser";
