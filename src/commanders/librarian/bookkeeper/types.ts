import { z } from "zod";
import type { NonEmptyArray } from "../../../types/helpers";
import {
	TreeNodeStatus,
	type TreeNodeStatus as TreeNodeStatusType,
} from "../healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../types/schemas/node-name";

// ─── Zod Enums ───

export const NoteKindSchema = z.enum(["Codex", "Page", "Scroll", "Unknown", "DictEntry"]);
export type NoteKind = z.infer<typeof NoteKindSchema>;
export const NoteKind = NoteKindSchema.enum;

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
	noteKind: "Page";
	status: TreeNodeStatusType;
	prevPageIdx?: number; // undefined if first page
	nextPageIdx?: number; // undefined if last page
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

// ─── Stream Pipeline Types ───

/**
 * A sentence extracted from content.
 */
export type SentenceToken = {
	/** Raw text of the sentence */
	text: string;
	/** Character count including trailing whitespace */
	charCount: number;
	/** Offset in original content */
	sourceOffset: number;
	/** True if sentence ends with sentence-ending punctuation */
	isComplete: boolean;
};

/**
 * Quote depth tracking state.
 */
export type QuoteState = {
	/** Current nesting depth (0 = not in quote) */
	depth: number;
	/** Stack of opening quote marks for matching */
	openingMarks: string[];
};

/**
 * Kind of keep-together region.
 */
export type RegionKind = "poem" | "multilineQuote" | "speechIntro";

/**
 * A sentence with context annotations.
 */
export type AnnotatedSentence = SentenceToken & {
	/** Quote nesting depth at this sentence */
	quoteDepth: number;
	/** Region this sentence belongs to, if any */
	inRegion: RegionKind | null;
	/** True if this sentence starts a new paragraph */
	startsNewParagraph: boolean;
	/** True if this is part of a poem/verse */
	isPoem: boolean;
};

/**
 * A group of sentences to keep together.
 */
export type SentenceGroup = {
	/** Sentences in this group (always non-empty) */
	sentences: NonEmptyArray<AnnotatedSentence>;
	/** Total character count */
	charCount: number;
	/** True if group can be split (false for poems, multiline quotes) */
	isSplittable: boolean;
};

/**
 * A line with its quote state at the end of the line.
 */
export type ScannedLine = {
	/** Raw line text */
	text: string;
	/** Line number (0-indexed) */
	lineNumber: number;
	/** Quote state after processing this line */
	quoteStateAfter: QuoteState;
	/** True if line is blank */
	isBlank: boolean;
	/** True if line is a markdown heading */
	isHeading: boolean;
	/** True if line could be part of a poem */
	isPotentialPoemLine: boolean;
};

// ─── Content Token Types ───

/**
 * A token representing either a sentence or a paragraph break.
 * Used in the pipeline to explicitly track paragraph boundaries.
 */
export type ContentToken =
	| { kind: "sentence"; sentence: AnnotatedSentence }
	| { kind: "paragraphBreak" };

/**
 * A sentence token before annotation (used in early pipeline stages).
 */
export type RawContentToken =
	| { kind: "sentence"; sentence: SentenceToken }
	| { kind: "paragraphBreak" };
