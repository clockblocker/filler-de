import type { QuoteState, ScannedLine } from "../../types";
import type { LanguageConfig } from "../language-config";

/**
 * Heading pattern (markdown).
 * Matches 1-6 hashes followed by:
 * - a space (standard markdown), OR
 * - directly followed by asterisk (e.g., `###### **ANNA:**`)
 */
const HEADING_PATTERN = /^#{1,6}(?:\s|(?=\*))/;

/**
 * Creates an initial (empty) quote state.
 */
export function createInitialQuoteState(): QuoteState {
	return { depth: 0, openingMarks: [] };
}

/**
 * Updates quote state for a character.
 */
function updateQuoteStateForChar(
	char: string,
	state: QuoteState,
	config: LanguageConfig,
): QuoteState {
	const { opening, closing, neutral } = config.quotes;

	if (opening.includes(char)) {
		return {
			depth: state.depth + 1,
			openingMarks: [...state.openingMarks, char],
		};
	}

	if (closing.includes(char)) {
		const newMarks = [...state.openingMarks];
		newMarks.pop();
		return {
			depth: Math.max(0, state.depth - 1),
			openingMarks: newMarks,
		};
	}

	if (neutral.includes(char)) {
		// Toggle: if inside quote, close; otherwise open
		if (state.depth > 0) {
			const newMarks = [...state.openingMarks];
			newMarks.pop();
			return {
				depth: state.depth - 1,
				openingMarks: newMarks,
			};
		}
		return {
			depth: state.depth + 1,
			openingMarks: [...state.openingMarks, char],
		};
	}

	return state;
}

/**
 * Processes a line and returns the quote state after processing.
 */
function processLineQuoteState(
	line: string,
	startState: QuoteState,
	config: LanguageConfig,
): QuoteState {
	let state = startState;
	for (const char of line) {
		state = updateQuoteStateForChar(char, state, config);
	}
	return state;
}

/**
 * Checks if a line is blank.
 */
function isBlankLine(line: string): boolean {
	return line.trim().length === 0;
}

/**
 * Checks if a line is a markdown heading.
 */
function isHeadingLine(line: string): boolean {
	return HEADING_PATTERN.test(line.trim());
}

/**
 * Checks if a line could be part of a poem.
 * Criteria:
 * - Has markdown line break (two trailing spaces)
 * - Is a short line (under maxLineLength chars when trimmed)
 */
function isPotentialPoemLine(line: string, config: LanguageConfig): boolean {
	// Check for markdown line break patterns
	for (const pattern of config.poemIndicators.linePatterns) {
		if (pattern.test(line)) return true;
	}

	// Check if line is short (potential verse)
	const trimmed = line.trim();
	if (
		trimmed.length > 0 &&
		trimmed.length < config.poemIndicators.maxLineLength
	) {
		return true;
	}

	return false;
}

/**
 * Stage 1: Line Scanner
 * Scans content line by line, tracking quote state.
 */
export function scanLines(
	content: string,
	config: LanguageConfig,
): ScannedLine[] {
	const lines = content.split("\n");
	const scannedLines: ScannedLine[] = [];
	let quoteState = createInitialQuoteState();

	for (let i = 0; i < lines.length; i++) {
		const text = lines[i] ?? "";
		const quoteStateAfter = processLineQuoteState(text, quoteState, config);

		scannedLines.push({
			isBlank: isBlankLine(text),
			isHeading: isHeadingLine(text),
			isPotentialPoemLine: isPotentialPoemLine(text, config),
			lineNumber: i,
			quoteStateAfter,
			text,
		});

		quoteState = quoteStateAfter;
	}

	return scannedLines;
}
