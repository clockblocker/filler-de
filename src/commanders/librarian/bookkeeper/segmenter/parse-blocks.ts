import {
	DialoguePosition,
	TextBlockKind,
	type TextBlock,
	type TextBlockKind as TextBlockKindType,
} from "../types";

/**
 * German dialogue patterns.
 * Matches lines that start or continue dialogue.
 */
const DIALOGUE_START_PATTERNS = [
	/^["„»«]/, // Starts with quotation mark
	/^[—–-]\s*["„»«]/, // Dash followed by quote (dialogue marker)
	/^[A-ZÄÖÜ][a-zäöüß]+:\s/, // Speaker name followed by colon
];

/**
 * Dialogue attribution verbs (German).
 * Used to detect lines that end dialogue exchanges.
 */
const DIALOGUE_ATTRIBUTION_PATTERN =
	/\b(sagte|fragte|rief|flüsterte|antwortete|meinte|erwiderte|sprach|schrie|murmelte)\b/i;

/**
 * Heading pattern (markdown).
 */
const HEADING_PATTERN = /^#{1,6}\s/;

/**
 * Checks if a line appears to be dialogue.
 */
function isDialogueLine(line: string): boolean {
	const trimmed = line.trim();
	if (trimmed.length === 0) return false;

	// Check start patterns
	for (const pattern of DIALOGUE_START_PATTERNS) {
		if (pattern.test(trimmed)) return true;
	}

	// Check for dialogue attribution at end
	if (DIALOGUE_ATTRIBUTION_PATTERN.test(trimmed)) return true;

	return false;
}

/**
 * Checks if a line is a markdown heading.
 */
function isHeadingLine(line: string): boolean {
	return HEADING_PATTERN.test(line.trim());
}

/**
 * Checks if a line is blank (empty or whitespace only).
 */
function isBlankLine(line: string): boolean {
	return line.trim().length === 0;
}

/**
 * Determines block kind for a line.
 */
function getLineKind(line: string): TextBlockKindType {
	if (isBlankLine(line)) return TextBlockKind.Blank;
	if (isHeadingLine(line)) return TextBlockKind.Heading;
	if (isDialogueLine(line)) return TextBlockKind.Dialogue;
	return TextBlockKind.Paragraph;
}

/**
 * Parses markdown content into structural blocks.
 * Groups consecutive lines of the same kind into blocks.
 * Special handling for dialogue to keep exchanges together.
 */
export function parseBlocks(content: string): TextBlock[] {
	const lines = content.split("\n");
	const blocks: TextBlock[] = [];

	let currentBlock: TextBlock | null = null;

	for (const line of lines) {
		const lineKind = getLineKind(line);

		// Blank lines always create a new block
		if (lineKind === TextBlockKind.Blank) {
			if (currentBlock) {
				blocks.push(currentBlock);
				currentBlock = null;
			}
			// Add blank block
			blocks.push({
				charCount: line.length + 1, // +1 for newline
				kind: TextBlockKind.Blank,
				lines: [line],
			});
			continue;
		}

		// Headings always standalone
		if (lineKind === TextBlockKind.Heading) {
			if (currentBlock) {
				blocks.push(currentBlock);
			}
			blocks.push({
				charCount: line.length + 1,
				kind: TextBlockKind.Heading,
				lines: [line],
			});
			currentBlock = null;
			continue;
		}

		// Continue current block if same kind
		if (currentBlock && currentBlock.kind === lineKind) {
			currentBlock.lines.push(line);
			currentBlock.charCount += line.length + 1;
			continue;
		}

		// Start new block
		if (currentBlock) {
			blocks.push(currentBlock);
		}
		currentBlock = {
			charCount: line.length + 1,
			kind: lineKind,
			lines: [line],
		};
	}

	// Don't forget last block
	if (currentBlock) {
		blocks.push(currentBlock);
	}

	// Post-process dialogue blocks to mark positions
	return markDialoguePositions(blocks);
}

/**
 * Marks dialogue blocks with their position in exchanges.
 * Consecutive dialogue blocks form an exchange.
 */
function markDialoguePositions(blocks: TextBlock[]): TextBlock[] {
	const result: TextBlock[] = [];
	let i = 0;

	while (i < blocks.length) {
		const block = blocks[i];
		if (!block) break;

		if (block.kind !== TextBlockKind.Dialogue) {
			result.push(block);
			i++;
			continue;
		}

		// Find consecutive dialogue blocks (allowing blanks between)
		const exchange: TextBlock[] = [block];

		i++;
		while (i < blocks.length) {
			const next = blocks[i];
			if (!next) break;

			if (next.kind === TextBlockKind.Dialogue) {
				exchange.push(next);
				i++;
			} else if (next.kind === TextBlockKind.Blank) {
				const afterNext = blocks[i + 1];
				if (afterNext && afterNext.kind === TextBlockKind.Dialogue) {
					// Allow single blank between dialogue lines
					exchange.push(next);
					i++;
				} else {
					break;
				}
			} else {
				break;
			}
		}

		// Mark positions
		if (exchange.length === 1) {
			const first = exchange[0];
			if (first) {
				result.push({ ...first, dialoguePosition: DialoguePosition.Single });
			}
		} else {
			for (const [j, exBlock] of exchange.entries()) {
				const pos =
					exBlock.kind === TextBlockKind.Blank
						? undefined
						: j === 0
							? DialoguePosition.Start
							: j === exchange.length - 1
								? DialoguePosition.End
								: DialoguePosition.Middle;
				result.push({
					...exBlock,
					dialoguePosition: pos,
				});
			}
		}
	}

	return result;
}

/**
 * Reconstructs content from blocks.
 */
export function blocksToContent(blocks: TextBlock[]): string {
	return blocks.flatMap((b) => b.lines).join("\n");
}

/**
 * Calculates total character count for blocks.
 */
export function blocksCharCount(blocks: TextBlock[]): number {
	return blocks.reduce((sum, b) => sum + b.charCount, 0);
}
