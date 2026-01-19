/**
 * Bookkeeper module - splits long markdown files into pages.
 */

// Action builders
export {
	buildPageSplitActions,
	buildTooShortMetadataAction,
} from "./build-actions";
// Errors
export {
	handleSplitToPagesError,
	makeSplitToPagesError,
	type SplitToPagesError,
	SplitToPagesErrorKind,
	SplitToPagesErrorKindSchema,
} from "./error";
// Page codec
export {
	buildPageBasename,
	buildPageFolderBasename,
	PAGE_PREFIX_PATTERN,
	parsePageIndex,
} from "./page-codec";
// Segmenter
export { segmentContent } from "./segmenter";
// Command handler
export type { SplitToPagesContext } from "./split-to-pages-action";
export { splitToPagesAction } from "./split-to-pages-action";
// Types
export type {
	DialoguePosition as DialoguePositionType,
	PageFrontmatter,
	PageSegment,
	SegmentationConfig,
	SegmentationResult,
	TextBlock,
	TextBlockKind as TextBlockKindType,
} from "./types";
export {
	DEFAULT_SEGMENTATION_CONFIG,
	DialoguePosition,
	DialoguePositionSchema,
	PAGE_FRONTMATTER,
	PAGE_INDEX_DIGITS,
	PAGE_PREFIX,
	TextBlockKind,
	TextBlockKindSchema,
} from "./types";
