/**
 * Wikilink parsing utilities.
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

/** Regex to match wikilinks: [[target]] or [[target|alias]] */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Parse all wikilinks from text.
 * @param text - Text containing wikilinks
 * @returns Array of parsed wikilinks
 */
function parse(text: string): ParsedWikilink[] {
	const results: ParsedWikilink[] = [];

	// Create new regex instance to avoid state issues
	const regex = new RegExp(WIKILINK_REGEX.source, WIKILINK_REGEX.flags);

	for (const match of text.matchAll(regex)) {
		const target = match[1]!;
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
function findByTarget(text: string, linkTarget: string): ParsedWikilink | null {
	const wikilinks = parse(text);
	return wikilinks.find((w) => w.target === linkTarget) ?? null;
}

/**
 * Check if text contains wikilinks. Alias for parse().
 * @param text - Text to check
 * @returns Array of parsed wikilinks (empty if none)
 */
function matchesPattern(text: string): ParsedWikilink[] {
	return parse(text);
}

/**
 * Execute the wikilink regex on text (for iteration).
 * Creates a fresh regex instance to avoid state issues.
 * @param text - Text to match against
 * @returns Iterator-compatible exec function
 */
function createMatcher(
	text: string,
): () => { target: string; alias: string | undefined } | null {
	const regex = new RegExp(WIKILINK_REGEX.source, WIKILINK_REGEX.flags);
	return () => {
		const match = regex.exec(text);
		if (!match) return null;
		return { alias: match[2], target: match[1]! };
	};
}

/**
 * Wikilink helper object with grouped functions.
 */
export const wikilinkHelper = {
	createMatcher,
	findByTarget,
	matchesPattern,
	parse,
};
