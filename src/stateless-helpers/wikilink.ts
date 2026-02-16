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

export type ParsedWikilinkRange = ParsedWikilink & {
	/** Start offset (inclusive) in the original text */
	start: number;
	/** End offset (exclusive) in the original text */
	end: number;
};

/** Regex to match wikilinks: [[target]] or [[target|alias]] */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Parse all wikilinks from text with offsets.
 * @param text - Text containing wikilinks
 * @returns Array of parsed wikilinks with start/end positions
 */
function parseWithRanges(text: string): ParsedWikilinkRange[] {
	const results: ParsedWikilinkRange[] = [];

	// Create new regex instance to avoid state issues
	const regex = new RegExp(WIKILINK_REGEX.source, WIKILINK_REGEX.flags);

	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const fullMatch = match[0];
		const target = match[1];
		const alias = match[2] ?? null;

		if (
			index === undefined ||
			typeof fullMatch !== "string" ||
			typeof target !== "string"
		) {
			continue;
		}

		results.push({
			alias,
			end: index + fullMatch.length,
			fullMatch,
			start: index,
			surface: alias ?? target,
			target,
		});
	}

	return results;
}

/**
 * Parse all wikilinks from text.
 * @param text - Text containing wikilinks
 * @returns Array of parsed wikilinks
 */
function parse(text: string): ParsedWikilink[] {
	return parseWithRanges(text).map(
		({ end: _, start: __, ...wikilink }) => wikilink,
	);
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
 * Find first wikilink by its displayed surface.
 */
function findBySurface(text: string, surface: string): ParsedWikilink | null {
	const wikilinks = parse(text);
	return wikilinks.find((w) => w.surface === surface) ?? null;
}

/**
 * Find the wikilink enclosing the given offset.
 */
function findEnclosingByOffset(
	text: string,
	offset: number,
): ParsedWikilinkRange | null {
	if (offset < 0) {
		return null;
	}

	const wikilinks = parseWithRanges(text);
	for (const wikilink of wikilinks) {
		if (offset >= wikilink.start && offset < wikilink.end) {
			return wikilink;
		}
	}
	return null;
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
	findBySurface,
	findByTarget,
	findEnclosingByOffset,
	matchesPattern,
	parse,
	parseWithRanges,
};
