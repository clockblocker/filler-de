import type { SeparatedSuffixedBasename } from "@textfresser/library-core";
import type {
	PageSegment,
	SegmentationConfig,
	SegmentationResult,
} from "../types";
import { DEFAULT_SEGMENTATION_CONFIG } from "../types";
import {
	formatBlocksWithMarkers,
	splitStrInSentenceBlocksWithIntermediate,
	stripBlockMarkers,
} from "./block-marker/split-str-in-sentence-blocks";
import { groupBlocksIntoPages } from "./page-formatter/block-page-accumulator";

/** Pages that hold anything, numbered again from 0. */
function filterEmptyPages(pages: PageSegment[]): PageSegment[] {
	return pages
		.filter((page) => page.content.trim().length > 0)
		.map((page, pageIndex) => ({ ...page, pageIndex }));
}

/**
 * Segments content into pages that already hold their block markers.
 *
 * 1. Splits the content into sentence blocks once
 *    (`splitStrInSentenceBlocksWithIntermediate`), one Sentence each.
 * 2. Groups the blocks into pages.
 * 3. Formats each page with block markers, each page starting at `^0`.
 *
 * @param content - The markdown content to segment
 * @param sourceBasenameInfo - Parsed basename info (coreName + suffixParts)
 * @param config - Segmentation configuration
 * @returns Segmentation result with pages containing block markers
 */
export function segmentContentWithBlockMarkers(
	content: string,
	sourceBasenameInfo: SeparatedSuffixedBasename,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): SegmentationResult {
	const { coreName, suffixParts } = sourceBasenameInfo;

	// Strip existing block markers for idempotency
	const withoutMarkers = stripBlockMarkers(content);
	const { blocks, markedText } = splitStrInSentenceBlocksWithIntermediate(
		withoutMarkers,
		0,
	);

	// Too short to split: one page, still marked
	if (withoutMarkers.length < config.minContentSizeChars) {
		return {
			pages: [
				{
					charCount: markedText.length,
					content: markedText,
					pageIndex: 0,
				},
			],
			sourceCoreName: coreName,
			sourceSuffix: suffixParts,
			tooShortToSplit: true,
		};
	}

	const pages = groupBlocksIntoPages(blocks, config).map(
		(group, pageIndex): PageSegment => {
			const marked = formatBlocksWithMarkers(group.blocks, 0);
			return { charCount: marked.length, content: marked, pageIndex };
		},
	);

	return {
		pages: filterEmptyPages(pages),
		sourceCoreName: coreName,
		sourceSuffix: suffixParts,
		tooShortToSplit: false,
	};
}
