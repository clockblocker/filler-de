import {
	DialoguePosition,
	type TextBlock,
	TextBlockKind,
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
 * Matches 1-6 hashes followed by:
 * - a space (standard markdown), OR
 * - directly followed by asterisk (e.g., `###### **ANNA:**`)
 */
const HEADING_PATTERN = /^#{1,6}(?:\s|(?=\*))/;

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
 * Patterns for German quote marks.
 * Using Unicode escapes to be explicit about characters:
 * - U+201E „ (DOUBLE LOW-9 QUOTATION MARK) - German opening
 * - U+00BB » (RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK) - French/German opening
 * - U+201D " (RIGHT DOUBLE QUOTATION MARK) - German closing
 * - U+00AB « (LEFT-POINTING DOUBLE ANGLE QUOTATION MARK) - French/German closing
 * - U+0022 " (QUOTATION MARK) - ASCII neutral
 */
const OPENING_QUOTE_PATTERN = /[\u201E\u00BB]/g;
const CLOSING_QUOTE_PATTERN = /[\u201D\u00AB]/g;
const _NEUTRAL_QUOTE_PATTERN = /\u0022/g;

/**
 * Counts net open quotes in a line given current open count.
 * Returns the new open quote count after processing this line.
 */
function updateQuoteCount(line: string, currentOpenCount: number): number {
	const openingMatches = line.match(OPENING_QUOTE_PATTERN);
	const closingMatches = line.match(CLOSING_QUOTE_PATTERN);

	const germanOpens = openingMatches?.length ?? 0;
	const germanCloses = closingMatches?.length ?? 0;

	// Process German quotes first (they're unambiguous)
	let openCount = currentOpenCount + germanOpens - germanCloses;

	// Process ASCII quotes character by character
	// Each " toggles: if inside quote, it closes; if outside, it opens
	for (const char of line) {
		if (char === '"') {
			if (openCount > 0) {
				openCount--; // Closing
			} else {
				openCount++; // Opening
			}
		}
	}

	return Math.max(0, openCount);
}

/**
 * Parses markdown content into structural blocks.
 * Groups consecutive lines of the same kind into blocks.
 * Special handling for dialogue to keep exchanges together.
 * Keeps multi-line quoted content (poems, songs) together even across blank lines.
 */
export function parseBlocks(content: string): TextBlock[] {
	const lines = content.split("\n");
	const blocks: TextBlock[] = [];

	let currentBlock: TextBlock | null = null;
	let openQuoteCount = 0; // Track unclosed quotes across lines

	for (const line of lines) {
		const lineKind = getLineKind(line);

		// Check if we're inside a quote BEFORE processing this line
		const wasInsideQuote = openQuoteCount > 0;

		// Handle blank lines - check quote state before updating
		if (lineKind === TextBlockKind.Blank) {
			// If inside a quote, don't break - keep blank line in current block
			if (wasInsideQuote && currentBlock) {
				currentBlock.lines.push(line);
				currentBlock.charCount += line.length + 1;
				currentBlock.isQuotedContent = true;
				continue;
			}

			// Normal case: blank line creates a new block
			if (currentBlock) {
				blocks.push(currentBlock);
				currentBlock = null;
			}
			blocks.push({
				charCount: line.length + 1,
				kind: TextBlockKind.Blank,
				lines: [line],
			});
			continue;
		}

		// Update quote count for non-blank lines
		openQuoteCount = updateQuoteCount(line, openQuoteCount);

		// Headings always standalone (even inside quotes - unlikely but safe)
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

		// If inside quote and we have a current block, extend it regardless of kind
		if (wasInsideQuote && currentBlock) {
			currentBlock.lines.push(line);
			currentBlock.charCount += line.length + 1;
			currentBlock.isQuotedContent = true;
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

	// Post-process: mark dialogue positions, then speech introductions
	const withDialoguePositions = markDialoguePositions(blocks);
	return markSpeechIntroductions(withDialoguePositions);
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
				result.push({
					...first,
					dialoguePosition: DialoguePosition.Single,
				});
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
 * Marks blocks that introduce speech (end with ':' followed by dialogue).
 * These blocks should not be split from the following dialogue.
 * Checks both Paragraph and Dialogue blocks (dialogue can introduce more dialogue).
 */
function markSpeechIntroductions(blocks: TextBlock[]): TextBlock[] {
	const result: TextBlock[] = [];

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (!block) continue;

		// Check if this block ends with ':' and is followed by dialogue
		// Both Paragraph and Dialogue blocks can introduce speech
		if (
			block.kind === TextBlockKind.Paragraph ||
			block.kind === TextBlockKind.Dialogue
		) {
			const lastLine = block.lines[block.lines.length - 1];
			if (lastLine?.trim().endsWith(":")) {
				// Look ahead for dialogue (skip blanks)
				const nextNonBlank = findNextNonBlankBlock(blocks, i + 1);
				if (nextNonBlank?.kind === TextBlockKind.Dialogue) {
					result.push({ ...block, introducesSpeech: true });
					continue;
				}
			}
		}

		result.push(block);
	}

	return result;
}

/**
 * Finds the next non-blank block starting from index.
 */
function findNextNonBlankBlock(
	blocks: TextBlock[],
	startIndex: number,
): TextBlock | undefined {
	for (let i = startIndex; i < blocks.length; i++) {
		const b = blocks[i];
		if (b && b.kind !== TextBlockKind.Blank) {
			return b;
		}
	}
	return undefined;
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
