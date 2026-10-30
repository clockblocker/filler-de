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
	/** Language config for segmentation */
	languageConfig: LanguageConfig;
};

export const DEFAULT_BLOCK_MARKER_CONFIG: BlockMarkerConfig = {
	languageConfig: DEFAULT_LANGUAGE_CONFIG,
};

/**
 * Result of splitting text into sentence blocks.
 */
export type BlockSplitResult = {
	/** Text with a block marker after each Sentence */
	markedText: string;
	/** Number of blocks created, one per Sentence */
	blockCount: number;
};
