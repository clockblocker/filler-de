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
 * Context for formatting blocks with headings and horizontal rules.
 */
export type FormatContext = {
	headings: ExtractedHeading[];
	horizontalRules: HorizontalRuleInfo[];
	offsetMap: (filtered: number) => number;
	protectedToFiltered: (prot: number) => number;
	protectedItems: ProtectedContent[];
};

/**
 * Format blocks into marked text with block IDs.
 * Preserves paragraph spacing by adding extra blank lines between paragraph-crossing blocks.
 * Reinserts headings before their corresponding content.
 * Reinserts horizontal rules between blocks (without block markers).
 */
export function formatBlocksWithMarkers(
	blocks: Block[],
	startIndex: number,
	context?: FormatContext,
): string {
	if (blocks.length === 0) return "";

	const parts: string[] = [];
	const usedHeadings = new Set<number>();
	const usedHRs = new Set<number>();

	// Convert FormatContext to HeadingInsertionContext
	const insertionContext: HeadingInsertionContext | undefined = context
		? {
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

		// Build block text with headings and HRs inserted for each sentence
		const rawBlockText = buildBlockTextWithHeadings(
			block.sentences,
			insertionContext,
			usedHeadings,
			usedHRs,
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

	return parts.join("");
}

/**
 * Restore protected markdown content within sentence texts in blocks.
 * Also adjusts sourceOffset to map from protected-space to filtered-space,
 * so that the heading offset map works correctly.
 */
export function restoreBlocksContent(
	blocks: Block[],
	protectedItems: ProtectedContent[],
): Block[] {
	if (protectedItems.length === 0) return blocks;

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
			return {
				...s,
				charCount: restoredText.length,
				sourceOffset: protectedToFiltered(s.sourceOffset),
				text: restoredText,
			};
		}),
	}));
}
