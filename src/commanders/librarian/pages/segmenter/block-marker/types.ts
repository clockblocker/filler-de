/**
 * Block Marker Types
 *
 * Shared types for the block marker module.
 */

/**
 * Result of splitting text into sentence blocks.
 */
export type BlockSplitResult = {
	/** Text with a block marker after each Sentence */
	markedText: string;
	/** Number of blocks created, one per Sentence */
	blockCount: number;
};
