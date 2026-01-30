/**
 * Block ID extraction utilities.
 * Supports both alphanumeric (e.g., ^abc-123) and numeric-only (e.g., ^6) block IDs.
 */

/** Pattern to match alphanumeric block ID at end of line */
export const BLOCK_ID_PATTERN = /\s\^([a-zA-Z0-9-]+)\s*$/;

/** Pattern to match numeric-only block ID at end of line */
const NUMERIC_BLOCK_ID_PATTERN = /\s\^(\d+)\s*$/;

/**
 * Extract block ID from end of line if present.
 * Supports alphanumeric block IDs (e.g., ^abc, ^abc-123, ^6).
 * @param line - The line text to check
 * @returns The block ID (without ^) or null if no block marker found
 */
export function extractBlockIdFromLine(line: string): string | null {
	const match = line.match(BLOCK_ID_PATTERN);
	return match ? match[1] : null;
}

/**
 * Extract numeric-only block ID from a line if it has one.
 * Only matches patterns like ^6, ^123 (digits only).
 * @param line - The line text to check
 * @returns The block ID (without ^) or null if no block marker found
 */
export function extractNumericBlockId(line: string): string | null {
	const match = line.match(NUMERIC_BLOCK_ID_PATTERN);
	return match ? match[1] : null;
}

/**
 * Find the highest block ID number in file content.
 * Matches patterns like " ^0", " ^123", etc.
 */
export function findHighestBlockNumber(content: string): number {
	// Match block markers at end of lines: " ^N" or "^N" at line end
	const matches = content.match(/\s\^(\d+)(?:\s*$|\n)/gm);
	if (!matches) return -1;

	const numbers = matches.map((match) => {
		const numMatch = match.match(/\^(\d+)/);
		return numMatch ? Number.parseInt(numMatch[1], 10) : 0;
	});

	return Math.max(-1, ...numbers);
}
