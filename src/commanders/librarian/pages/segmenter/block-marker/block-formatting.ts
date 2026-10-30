/**
 * Block Formatting
 *
 * Formats sentence blocks with markers and restores protected content.
 */

import {
	offsetMapperHelper,
	type ReplacedItem,
} from "../../../../../stateless-helpers/offset-mapper";
import type { ProtectedContent } from "../stream/markdown-protector";
import { restoreProtectedContent } from "../stream/markdown-protector";
import type { ExtractedHeading } from "./heading-extraction";
import {
	buildBlockTextWithHeadings,
	type CodeBlockInfo,
	collectTrailingElements,
	type HeadingInsertionContext,
	type HorizontalRuleInfo,
} from "./heading-insertion";
import type { Block } from "./sentence-blocks";

/**
 * Context for formatting blocks with headings, horizontal rules, and code blocks.
 */
export type FormatContext = {
	headings: ExtractedHeading[];
	horizontalRules: HorizontalRuleInfo[];
	codeBlocks: CodeBlockInfo[];
	offsetMap: (filtered: number) => number;
	protectedToFiltered: (prot: number) => number;
	protectedItems: ProtectedContent[];
};

/**
 * Format sentence blocks into marked text with block IDs: each Sentence,
 * then ` ^N`, with a blank line before the next one.
 * Preserves paragraph spacing by adding extra blank lines between paragraph-crossing blocks.
 * Reinserts headings before their corresponding content.
 * Reinserts horizontal rules and code blocks between blocks (without block markers).
 *
 * @param blocks - Blocks to format
 * @param startIndex - Starting block ID (e.g., ^0, ^1, ...)
 * @param context - Optional context for heading/HR/code block insertion
 * @param usedHeadings - Optional set tracking already-used headings (for multi-page formatting)
 * @param usedHRs - Optional set tracking already-used HRs (for multi-page formatting)
 * @param usedCodeBlocks - Optional set tracking already-used code blocks (for multi-page formatting)
 */
export function formatBlocksWithMarkers(
	blocks: Block[],
	startIndex: number,
	context?: FormatContext,
	usedHeadings?: Set<number>,
	usedHRs?: Set<number>,
	usedCodeBlocks?: Set<number>,
): string {
	if (blocks.length === 0) return "";

	const parts: string[] = [];
	const headingsSet = usedHeadings ?? new Set<number>();
	const hrsSet = usedHRs ?? new Set<number>();
	const codeBlocksSet = usedCodeBlocks ?? new Set<number>();

	// Convert FormatContext to HeadingInsertionContext
	const insertionContext: HeadingInsertionContext | undefined = context
		? {
				codeBlocks: context.codeBlocks,
				headings: context.headings,
				horizontalRules: context.horizontalRules,
				offsetMap: context.offsetMap,
				protectedItems: context.protectedItems,
				protectedToFiltered: context.protectedToFiltered,
			}
		: undefined;

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (!block) continue;

		// Build block text with headings, HRs, and code blocks inserted before the sentence
		const blockText = buildBlockTextWithHeadings(
			[block.sentence],
			insertionContext,
			headingsSet,
			hrsSet,
			codeBlocksSet,
		).trim();
		const blockId = startIndex + i;
		const markedBlock = `${blockText} ^${blockId}`;

		if (i === 0) {
			parts.push(markedBlock);
			continue;
		}

		// Check if this block starts a new paragraph
		const startsNewParagraph = block.sentence.startsNewParagraph;

		if (startsNewParagraph) {
			// Extra blank lines for paragraph boundary (3 blank lines = 4 newlines)
			parts.push(`\n\n\n\n${markedBlock}`);
		} else {
			// Standard single blank line between blocks
			parts.push(`\n\n${markedBlock}`);
		}
	}

	// Collect and append trailing elements (HRs, code blocks) that come after all blocks
	if (insertionContext) {
		const trailingElements = collectTrailingElements(
			insertionContext,
			hrsSet,
			codeBlocksSet,
		);
		if (trailingElements.length > 0) {
			const trailingText = trailingElements.map((e) => e.text).join("\n");
			parts.push(`\n\n${trailingText}`);
		}
	}

	return parts.join("");
}

/**
 * Restore protected markdown content within each block's sentence.
 * Also adjusts sourceOffset to map from stripped-space to filtered-space,
 * so that the heading offset map works correctly.
 *
 * Offset conversion chain: stripped → protected → filtered
 *
 * @param strippedToProtected - Maps offsets from stripped space (after decoration removal)
 *                              to protected space (before decoration removal). If not provided,
 *                              assumes no decoration stripping occurred (identity mapping).
 */
export function restoreBlocksContent(
	blocks: Block[],
	protectedItems: ProtectedContent[],
	strippedToProtected?: (offset: number) => number,
): Block[] {
	if (protectedItems.length === 0 && !strippedToProtected) return blocks;

	// Convert ProtectedContent[] to ReplacedItem[] for the helper
	const replacedItems: ReplacedItem[] = protectedItems.map((item) => ({
		original: item.original,
		placeholder: item.placeholder,
		startOffset: item.startOffset,
	}));
	const protectedToFiltered =
		offsetMapperHelper.createReplacementMap(replacedItems);

	return blocks.map(({ sentence }) => {
		const restoredText = restoreProtectedContent(
			sentence.text,
			protectedItems,
		);
		// Convert: stripped → protected → filtered
		const protectedOffset = strippedToProtected
			? strippedToProtected(sentence.sourceOffset)
			: sentence.sourceOffset;
		const filteredOffset = protectedToFiltered(protectedOffset);
		return {
			charCount: restoredText.length,
			sentence: {
				...sentence,
				charCount: restoredText.length,
				sourceOffset: filteredOffset,
				text: restoredText,
			},
		};
	});
}
