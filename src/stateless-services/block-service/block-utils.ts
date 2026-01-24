/**
 * Shared utilities for block marker operations.
 */

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

/**
 * Format a block embed wikilink.
 * @param basename - The file basename (without extension)
 * @param blockId - The block ID (without ^)
 * @returns Formatted embed like `![[basename#^id|^]]`
 */
export function formatBlockEmbed(basename: string, blockId: string): string {
	return `![[${basename}#^${blockId}|^]]`;
}

/**
 * Extract block ID from a line if it has one.
 * @param line - The line text to check
 * @returns The block ID (without ^) or null if no block marker found
 */
export function getBlockIdFromLine(line: string): string | null {
	// Match block marker at end of line: " ^N" where N is digits
	const match = line.match(/\s\^(\d+)\s*$/);
	return match ? match[1] : null;
}
