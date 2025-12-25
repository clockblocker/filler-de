import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../services/dto-services/quote-manager/interface";
import type { LinkedQuote } from "../../services/dto-services/quote-manager/types";

const DEFAULT_MAX_BLOCKS_PER_PAGE = 15;

export type SplitResult = {
	pages: string[];
	isBook: boolean;
};

type QuotedLine = LinkedQuote | string;

/**
 * Splits text content into pages using formatted sentence segmentation.
 * Preserves headers, handles direct speech, and creates linked quotes.
 */
export function splitTextIntoPages(
	content: string,
	textName: string,
	maxBlocksPerPage = DEFAULT_MAX_BLOCKS_PER_PAGE,
): SplitResult {
	// Segment into quoted lines (sentences with IDs, headers, etc.)
	const quotedLines = segmentInQuotedLines({
		highestBlockNumber: 0,
		nameOfTheOpenendFile: textName,
		text: content,
	});

	// Count actual content blocks (LinkedQuote objects)
	const contentBlocks = quotedLines.filter(
		(line): line is LinkedQuote => typeof line !== "string",
	);

	// If empty or fits in one page → scroll
	if (contentBlocks.length <= maxBlocksPerPage) {
		return {
			isBook: false,
			pages: [formatQuotedLines(quotedLines)],
		};
	}

	// Split into pages
	const pages: string[] = [];
	let currentPage: QuotedLine[] = [];
	let blockCount = 0;

	for (const line of quotedLines) {
		currentPage.push(line);

		// Only count content blocks toward page limit
		if (typeof line !== "string") {
			blockCount++;
		}

		if (blockCount >= maxBlocksPerPage) {
			pages.push(formatQuotedLines(currentPage));
			currentPage = [];
			blockCount = 0;
		}
	}

	// Don't forget remaining content
	if (currentPage.length > 0) {
		pages.push(formatQuotedLines(currentPage));
	}

	return {
		isBook: pages.length > 1,
		pages,
	};
}
