import { z } from "zod";
import {
	TreeNodeStatus,
	type TreeNodeStatus as TreeNodeStatusType,
} from "../healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../types/schemas/node-name";

// ─── Zod Enums ───

export const TextBlockKindSchema = z.enum([
	"Paragraph",
	"Heading",
	"Dialogue",
	"Blank",
]);
export type TextBlockKind = z.infer<typeof TextBlockKindSchema>;
export const TextBlockKind = TextBlockKindSchema.enum;

export const DialoguePositionSchema = z.enum([
	"Start",
	"Middle",
	"End",
	"Single",
]);
export type DialoguePosition = z.infer<typeof DialoguePositionSchema>;
export const DialoguePosition = DialoguePositionSchema.enum;

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
 * A structural block of content.
 */
export type TextBlock = {
	kind: TextBlockKind;
	lines: string[];
	charCount: number;
	/** For dialogue blocks: tracks if this is start/middle/end of dialogue exchange */
	dialoguePosition?: DialoguePosition;
	/** True if this block was created by sentence-level splitting */
	isSentenceSplit?: boolean;
	/** True if block ends with ':' and is followed by dialogue (speech intro) */
	introducesSpeech?: boolean;
	/** True if block is multi-line quoted content (poem, song) */
	isQuotedContent?: boolean;
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
	status: TreeNodeStatusType;
};

export const PAGE_FRONTMATTER: PageFrontmatter = {
	noteType: "Page",
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
