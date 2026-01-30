/**
 * Extract block ID from a line of text.
 * Supports alphanumeric block IDs (unlike block-utils which only supports numeric).
 */

/**
 * Extract block ID from end of line if present.
 * Pattern: space followed by ^, then alphanumeric/hyphen chars at end of line.
 * @param line - The line text to check
 * @returns The block ID (without ^) or null if no block marker found
 */
export function extractBlockIdFromLine(line: string): string | null {
	const match = line.match(/\s\^([a-zA-Z0-9-]+)\s*$/);
	return match ? match[1] : null;
}
