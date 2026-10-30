/**
 * Block Formatting
 *
 * Writes sentence blocks with their markers: each block's Sentence, then
 * ` ^N`, with a blank line before the next block, or three where a
 * paragraph ends. What stands before a block and is no Sentence, such as
 * a heading, comes right before its Sentence; what follows the last block
 * comes after it.
 */

import type { Block } from "./sentence-blocks";

/**
 * The blocks as marked text, their IDs counting up from `startIndex`
 * (`^0`, `^1`, …).
 */
export function formatBlocksWithMarkers(
	blocks: readonly Block[],
	startIndex: number,
): string {
	return blocks
		.map((block, index) => {
			const marked = `${block.lead}${block.text} ^${startIndex + index}${block.trail}`;
			if (index === 0) return marked;
			return `${block.startsNewParagraph ? "\n\n\n\n" : "\n\n"}${marked}`;
		})
		.join("");
}
