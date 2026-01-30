/**
 * TextfresserContext module - builds structured context from wikilink clicks.
 */

// Re-export from pure-formatting-utils for backwards compatibility
export {
	extractBlockIdFromLine,
	type ParsedWikilink,
	findClickedWikilink,
	parseWikilinks,
	replaceWikilinksWithSurface,
	stripBlockRefs,
	stripBoldMarkers,
	stripMarkdownForContext,
} from "../../../pure-formatting-utils";

export {
	type ContextBuilderInput,
	buildTextfresserContext,
} from "./context-builder";
export type {
	ContextError,
	TargetMatchesBaseform,
	TextfresserContext,
} from "./types";
export { noClickError, wikilinkNotFoundError } from "./types";
