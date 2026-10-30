import type { NodeName } from "@textfresser/library-core";
import { TreeNodeStatus } from "@textfresser/library-core";

// ─── Types ───

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
	maxPageSizeChars: 6000,
	minContentSizeChars: 1500,
	preserveDialogues: true,
	preserveParagraphs: true,
	targetPageSizeChars: 3000,
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
type PageFrontmatter = {
	noteKind: "Page";
	status: typeof TreeNodeStatus.NotStarted;
};

export const PAGE_FRONTMATTER: PageFrontmatter = {
	noteKind: "Page",
	status: TreeNodeStatus.NotStarted,
};

/**
 * Page prefix literal.
 */
export const PAGE_PREFIX = "Page";

/**
 * Number of digits for page index (e.g., 3 → CoreName_Page_000).
 */
export const PAGE_INDEX_DIGITS = 3;
