import {
	DialoguePosition,
	type SegmentationConfig,
	type TextBlock,
	TextBlockKind,
} from "../../types";

/**
 * A segmentation rule determines where content can be split.
 */
export type SegmentationRule = {
	name: string;
	priority: number;
	/**
	 * Returns true if splitting is allowed between blockA and blockB.
	 */
	canSplitBetween: (
		blockA: TextBlock,
		blockB: TextBlock,
		config: SegmentationConfig,
	) => boolean;
};

/**
 * Dialogue rule: Never split within a dialogue exchange.
 * Allows split only when dialogue has ended (position is "End" or "Single").
 */
export const dialogueRule: SegmentationRule = {
	canSplitBetween: (blockA, _blockB, config) => {
		if (!config.preserveDialogues) return true;

		// If blockA is dialogue and not at end of exchange, don't split
		if (blockA.kind === TextBlockKind.Dialogue) {
			const pos = blockA.dialoguePosition;
			return (
				pos === DialoguePosition.End || pos === DialoguePosition.Single
			);
		}
		return true;
	},
	name: "Dialogue",
	priority: 1, // Highest priority
};

/**
 * Paragraph rule: Never split in the middle of a paragraph.
 * Since blocks are already separated by type, this rule ensures
 * we only split at block boundaries (which is always the case).
 */
export const paragraphRule: SegmentationRule = {
	canSplitBetween: (_blockA, _blockB, config) => {
		if (!config.preserveParagraphs) return true;
		// Blocks are atomic units, so splitting between blocks is always OK
		// for paragraph preservation (we never split within a block)
		return true;
	},
	name: "Paragraph",
	priority: 2,
};

/**
 * Speech introduction rule: Don't split between a block that introduces
 * speech (ends with ':') and the following dialogue.
 */
export const speechIntroductionRule: SegmentationRule = {
	canSplitBetween: (blockA, _blockB, _config) => {
		// If blockA introduces speech, don't allow split
		if (blockA.introducesSpeech) {
			return false;
		}
		return true;
	},
	name: "SpeechIntroduction",
	priority: 1, // Same priority as dialogue - speech context is important
};

/**
 * Heading rule: Prefer to split before headings.
 * This is a soft preference - it returns true always but
 * the segmenter can use this to prefer heading boundaries.
 */
export const headingRule: SegmentationRule = {
	canSplitBetween: (_blockA, _blockB, _config) => {
		// Always allow, but segmenter prefers heading boundaries
		return true;
	},
	name: "Heading",
	priority: 3,
};

/**
 * Size rule: Enforces maximum page size.
 * Always allows split when current page exceeds max size.
 */
export const sizeRule: SegmentationRule = {
	canSplitBetween: (_blockA, _blockB, _config) => {
		// Size is handled separately in the segmenter
		return true;
	},
	name: "size",
	priority: 4,
};

/**
 * All rules in priority order.
 * NOTE: dialogueRule removed - the new sentence-stream pipeline handles
 * dialogue and quoted content via quote depth tracking, not pattern matching.
 */
export const ALL_RULES: SegmentationRule[] = [
	speechIntroductionRule,
	paragraphRule,
	headingRule,
	sizeRule,
];

/**
 * Checks if splitting between two blocks is allowed by all rules.
 */
export function canSplitBetweenBlocks(
	blockA: TextBlock,
	blockB: TextBlock,
	config: SegmentationConfig,
): boolean {
	for (const rule of ALL_RULES) {
		if (!rule.canSplitBetween(blockA, blockB, config)) {
			return false;
		}
	}
	return true;
}

/**
 * Returns true if blockB is a preferred split point (e.g., heading).
 */
export function isPreferredSplitPoint(blockB: TextBlock): boolean {
	return blockB.kind === TextBlockKind.Heading;
}
