import { type TextBlock, TextBlockKind } from "../types";

/**
 * German sentence segmenter using Intl.Segmenter.
 */
const sentenceSegmenter = new Intl.Segmenter("de", { granularity: "sentence" });

/**
 * Checks if a block can be split at sentence boundaries.
 * Only paragraph blocks can be split; dialogue/heading/blank cannot.
 */
export function canSplitBlock(block: TextBlock): boolean {
	return block.kind === TextBlockKind.Paragraph;
}

/**
 * Splits a paragraph block at sentence boundaries to fit target size.
 * Returns original block unchanged if:
 * - Block is not a paragraph
 * - Block fits within target size
 * - Block has only one sentence
 *
 * @param block - Block to potentially split
 * @param targetSize - Target character count per sub-block
 * @returns Array of blocks (original if no split, multiple if split)
 */
export function splitBlockAtSentenceBoundary(
	block: TextBlock,
	targetSize: number,
): TextBlock[] {
	// Only split paragraph blocks
	if (!canSplitBlock(block)) {
		return [block];
	}

	// Block already fits
	if (block.charCount <= targetSize) {
		return [block];
	}

	const text = block.lines.join("\n");
	const segments = [...sentenceSegmenter.segment(text)];

	// Single sentence - can't split
	if (segments.length <= 1) {
		return [block];
	}

	// Group sentences into sub-blocks
	const subBlocks: TextBlock[] = [];
	let currentLines: string[] = [];
	let currentCharCount = 0;

	for (const segment of segments) {
		const sentenceText = segment.segment;
		const sentenceChars = sentenceText.length;

		// If adding this sentence exceeds target and we have content, start new sub-block
		if (
			currentCharCount > 0 &&
			currentCharCount + sentenceChars > targetSize
		) {
			subBlocks.push(createSubBlock(currentLines, currentCharCount));
			currentLines = [];
			currentCharCount = 0;
		}

		// Add sentence to current sub-block
		// Split by newlines to preserve line structure
		const sentenceLines = sentenceText.split("\n");
		currentLines.push(...sentenceLines);
		currentCharCount += sentenceChars;
	}

	// Don't forget remaining content
	if (currentLines.length > 0) {
		subBlocks.push(createSubBlock(currentLines, currentCharCount));
	}

	// If we ended up with just one block, return original
	if (subBlocks.length <= 1) {
		return [block];
	}

	return subBlocks;
}

/**
 * Creates a sub-block from sentence-split content.
 */
function createSubBlock(lines: string[], charCount: number): TextBlock {
	return {
		charCount,
		isSentenceSplit: true,
		kind: TextBlockKind.Paragraph,
		lines,
	};
}
