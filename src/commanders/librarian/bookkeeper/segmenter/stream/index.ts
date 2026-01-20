/**
 * Stream pipeline for text segmentation.
 *
 * Pipeline stages:
 * 1. Line Scanner: Scans lines and tracks quote state
 * 2. Sentence Segmenter: Splits into sentences using Intl.Segmenter
 * 3. Context Annotator: Adds quote depth, region markers
 * 4. Region Grouper: Groups keep-together content (poems, quotes)
 * 5. Page Accumulator: Builds pages respecting size limits
 */

export { annotateSentences, annotateTokens } from "./context-annotator";
export { createInitialQuoteState, scanLines } from "./line-scanner";
export {
	accumulatePages,
	preprocessLargeGroups,
	splitLargeGroup,
} from "./page-accumulator";
export { flattenGroups, groupSentences, groupTokens } from "./region-grouper";
export {
	segmentSentences,
	segmentToTokens,
	segmentWithParagraphs,
} from "./sentence-segmenter";
