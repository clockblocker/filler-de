/**
 * Parse wikilinks from text and find clicked wikilinks.
 */

export type ParsedWikilink = {
	/** Full match including brackets: [[target]] or [[target|alias]] */
	fullMatch: string;
	/** The link target (before |) */
	target: string;
	/** The alias (after |) or null */
	alias: string | null;
	/** The displayed surface: alias if exists, else target */
	surface: string;
};

const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Parse all wikilinks from text.
 * @param text - Text containing wikilinks
 * @returns Array of parsed wikilinks
 */
export function parseWikilinks(text: string): ParsedWikilink[] {
	const results: ParsedWikilink[] = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	WIKILINK_REGEX.lastIndex = 0;

	while ((match = WIKILINK_REGEX.exec(text)) !== null) {
		const target = match[1];
		const alias = match[2] ?? null;
		results.push({
			alias,
			fullMatch: match[0],
			surface: alias ?? target,
			target,
		});
	}

	return results;
}

/**
 * Find a wikilink by its target.
 * @param text - Text containing wikilinks
 * @param linkTarget - The target to search for
 * @returns The matched wikilink or null
 */
export function findClickedWikilink(
	text: string,
	linkTarget: string,
): ParsedWikilink | null {
	const wikilinks = parseWikilinks(text);
	return wikilinks.find((w) => w.target === linkTarget) ?? null;
}
