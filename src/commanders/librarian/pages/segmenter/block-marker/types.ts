/**
 * Block Marker Types
 *
 * Shared types for the block marker module.
 */

import type { LanguageConfig } from "../language-config";
import { DEFAULT_LANGUAGE_CONFIG } from "../language-config";

/**
 * Configuration for block marking.
 */
export type BlockMarkerConfig = {
	/** Max words to consider a sentence "short" (default 4) */
	shortSentenceWords: number;
	/** Max words for merged block (default 30) */
	maxMergedWords: number;
	/** Language config for segmentation */
	languageConfig: LanguageConfig;
};

export const DEFAULT_BLOCK_MARKER_CONFIG: BlockMarkerConfig = {
	languageConfig: DEFAULT_LANGUAGE_CONFIG,
	maxMergedWords: 30,
	shortSentenceWords: 4,
};

/**
 * Result of block splitting.
 */
export type BlockSplitResult = {
	/** Text with block markers appended */
	markedText: string;
	/** Number of blocks created */
	blockCount: number;
};
