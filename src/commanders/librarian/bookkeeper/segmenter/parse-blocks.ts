import type { Block, BlockType } from "../types";

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
 * Determines block type for a line.
 */
function getLineType(line: string): BlockType {
	if (isBlankLine(line)) return "blank";
	if (isHeadingLine(line)) return "heading";
	if (isDialogueLine(line)) return "dialogue";
	return "paragraph";
}

/**
 * Parses markdown content into structural blocks.
 * Groups consecutive lines of the same type into blocks.
 * Special handling for dialogue to keep exchanges together.
 */
export function parseBlocks(content: string): Block[] {
	const lines = content.split("\n");
	const blocks: Block[] = [];

	let currentBlock: Block | null = null;

	for (const line of lines) {
		const lineType = getLineType(line);

		// Blank lines always create a new block
		if (lineType === "blank") {
			if (currentBlock) {
				blocks.push(currentBlock);
				currentBlock = null;
			}
			// Add blank block
			blocks.push({
				charCount: line.length + 1, // +1 for newline
				lines: [line],
				type: "blank",
			});
			continue;
		}

		// Headings always standalone
		if (lineType === "heading") {
			if (currentBlock) {
				blocks.push(currentBlock);
			}
			blocks.push({
				charCount: line.length + 1,
				lines: [line],
				type: "heading",
			});
			currentBlock = null;
			continue;
		}

		// Continue current block if same type
		if (currentBlock && currentBlock.type === lineType) {
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
			lines: [line],
			type: lineType,
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
function markDialoguePositions(blocks: Block[]): Block[] {
	const result: Block[] = [];
	let i = 0;

	while (i < blocks.length) {
		const block = blocks[i];

		if (block.type !== "dialogue") {
			result.push(block);
			i++;
			continue;
		}

		// Find consecutive dialogue blocks (allowing blanks between)
		const exchange: Block[] = [block];

		i++;
		while (i < blocks.length) {
			const next = blocks[i];
			if (next.type === "dialogue") {
				exchange.push(next);
				i++;
			} else if (
				next.type === "blank" &&
				i + 1 < blocks.length &&
				blocks[i + 1].type === "dialogue"
			) {
				// Allow single blank between dialogue lines
				exchange.push(next);
				i++;
			} else {
				break;
			}
		}

		// Mark positions
		if (exchange.length === 1) {
			result.push({ ...exchange[0], dialoguePosition: "single" });
		} else {
			for (let j = 0; j < exchange.length; j++) {
				const pos =
					exchange[j].type === "blank"
						? undefined
						: j === 0
							? "start"
							: j === exchange.length - 1
								? "end"
								: "middle";
				result.push({
					...exchange[j],
					dialoguePosition: pos as Block["dialoguePosition"],
				});
			}
		}
	}

	return result;
}

/**
 * Reconstructs content from blocks.
 */
export function blocksToContent(blocks: Block[]): string {
	return blocks.flatMap((b) => b.lines).join("\n");
}

/**
 * Calculates total character count for blocks.
 */
export function blocksCharCount(blocks: Block[]): number {
	return blocks.reduce((sum, b) => sum + b.charCount, 0);
}
