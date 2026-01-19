import type { NodeName } from "../types/schemas/node-name";

/**
 * Configuration for page segmentation.
 */
export type SegmentationConfig = {
	/** Target page size in characters (~3000) */
	targetPageSizeChars: number;
	/** Hard limit for page size (~5000) */
	maxPageSizeChars: number;
	/** Minimum content size to warrant splitting */
	minContentSizeChars: number;
	/** Keep dialogue blocks together on same page */
	preserveDialogues: boolean;
	/** Never split mid-paragraph */
	preserveParagraphs: boolean;
};

export const DEFAULT_SEGMENTATION_CONFIG: SegmentationConfig = {
	maxPageSizeChars: 5000,
	minContentSizeChars: 1500,
	preserveDialogues: true,
	preserveParagraphs: true,
	targetPageSizeChars: 3000,
};

/**
 * Block types recognized during parsing.
 */
export type BlockType = "paragraph" | "heading" | "dialogue" | "blank";

/**
 * A structural block of content.
 */
export type Block = {
	type: BlockType;
	lines: string[];
	charCount: number;
	/** For dialogue blocks: tracks if this is start/middle/end of dialogue exchange */
	dialoguePosition?: "start" | "middle" | "end" | "single";
};

/**
 * A single page segment.
 */
export type PageSegment = {
	content: string;
	pageIndex: number;
	charCount: number;
};

/**
 * Result of segmentation.
 */
export type SegmentationResult = {
	pages: PageSegment[];
	/** Core name of source file (e.g., "Aschenputtel") */
	sourceCoreName: NodeName;
	/** Suffix parts from source (e.g., ["Märchen"]) */
	sourceSuffix: NodeName[];
	/** Whether content was too short to split */
	tooShortToSplit: boolean;
};

/**
 * Frontmatter added to all page files.
 */
export type PageFrontmatter = {
	noteType: "Page";
};

export const PAGE_FRONTMATTER: PageFrontmatter = {
	noteType: "Page",
};

/**
 * Page prefix literal.
 */
export const PAGE_PREFIX = "Page";

/**
 * Number of digits for page index (e.g., 3 → Page000, Page001).
 */
export const PAGE_INDEX_DIGITS = 3;
