/**
 * Bookkeeper module - splits long markdown files into pages.
 */

// Action builders
export {
	buildPageSplitActions,
	buildTooShortMetadataAction,
} from "./build-actions";
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
	BlockType,
	PageFrontmatter,
	PageSegment,
	SegmentationConfig,
	SegmentationResult,
	TextBlock as Block,
} from "./types";
export {
	DEFAULT_SEGMENTATION_CONFIG,
	PAGE_FRONTMATTER,
	PAGE_INDEX_DIGITS,
	PAGE_PREFIX,
} from "./types";
