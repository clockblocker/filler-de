/**
 * Block Formatting
 *
 * Formats blocks with markers and restores protected content.
 */

import {
	offsetMapperHelper,
	type ReplacedItem,
} from "../../../../../stateless-helpers/offset-mapper";
import type { ProtectedContent } from "../stream/markdown-protector";
import { restoreProtectedContent } from "../stream/markdown-protector";
import type { Block } from "./block-grouping";
import type { ExtractedHeading } from "./heading-extraction";
import {
	buildBlockTextWithHeadings,
	type CodeBlockInfo,
	collectTrailingElements,
	type HeadingInsertionContext,
	type HorizontalRuleInfo,
} from "./heading-insertion";

/**
 * Merge adjacent decorations within a block.
 * When multiple decorated sentences end up in the same block, merge them:
 * `*text1* *text2*` → `*text1 text2*`
 *
 * Handles all decoration types: *, **, ***, ~~, ==
 */
function mergeAdjacentDecorations(text: string): string {
	return (
		text
			// Must match longer markers first to avoid partial replacements
			// Bold+italic: *** + whitespace + ***
			.replace(/\*\*\*\s+\*\*\*/g, " ")
			// Bold: ** + whitespace + **
			.replace(/\*\*\s+\*\*/g, " ")
			// Italic: * + whitespace + * (but not ** or ***)
			// Use negative lookbehind/lookahead to avoid matching ** or ***
			.replace(/(?<!\*)\*(?!\*)\s+(?<!\*)\*(?!\*)/g, " ")
			// Strikethrough: ~~ + whitespace + ~~
			.replace(/~~\s+~~/g, " ")
			// Highlight: == + whitespace + ==
			.replace(/==\s+==/g, " ")
	);
}

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
 * Format blocks into marked text with block IDs.
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

		// Build block text with headings, HRs, and code blocks inserted for each sentence
		const rawBlockText = buildBlockTextWithHeadings(
			block.sentences,
			insertionContext,
			headingsSet,
			hrsSet,
			codeBlocksSet,
		).trim();
		// Merge adjacent decorations: *a* *b* → *a b*
		const blockText = mergeAdjacentDecorations(rawBlockText);
		const blockId = startIndex + i;
		const markedBlock = `${blockText} ^${blockId}`;

		if (i === 0) {
			parts.push(markedBlock);
			continue;
		}

		// Check if this block starts a new paragraph
		const firstSentence = block.sentences[0];
		const startsNewParagraph = firstSentence?.startsNewParagraph ?? false;

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
 * Restore protected markdown content within sentence texts in blocks.
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

	return blocks.map((block) => ({
		...block,
		sentences: block.sentences.map((s) => {
			const restoredText = restoreProtectedContent(
				s.text,
				protectedItems,
			);
			// Convert: stripped → protected → filtered
			const protectedOffset = strippedToProtected
				? strippedToProtected(s.sourceOffset)
				: s.sourceOffset;
			const filteredOffset = protectedToFiltered(protectedOffset);
			return {
				...s,
				charCount: restoredText.length,
				sourceOffset: filteredOffset,
				text: restoredText,
			};
		}),
	}));
}
