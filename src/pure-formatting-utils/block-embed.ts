/**
 * Block embed formatting utilities.
 */

/**
 * Format a block embed wikilink.
 * @param basename - The file basename (without extension)
 * @param blockId - The block ID (without ^)
 * @returns Formatted embed like `![[basename#^id|^]]`
 */
export function formatBlockEmbed(basename: string, blockId: string): string {
	return `![[${basename}#^${blockId}|^]]`;
}
