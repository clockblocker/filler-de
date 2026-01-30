/**
 * Strip markdown formatting for context display.
 */

/**
 * Remove bold markers (**text** → text).
 */
export function stripBoldMarkers(text: string): string {
	return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

/**
 * Remove block references at end of line ( ^id → removed).
 */
export function stripBlockRefs(text: string): string {
	return text.replace(/\s\^[a-zA-Z0-9-]+\s*$/, "");
}

/**
 * Replace wikilinks with their surface text.
 * [[target]] → target
 * [[target|alias]] → alias
 */
export function replaceWikilinksWithSurface(text: string): string {
	return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) =>
		alias ?? target,
	);
}

/**
 * Strip all markdown formatting for context display.
 * Removes bold, block refs, replaces wikilinks with surface.
 */
export function stripMarkdownForContext(text: string): string {
	let result = text;
	result = stripBoldMarkers(result);
	result = replaceWikilinksWithSurface(result);
	result = stripBlockRefs(result);
	return result;
}
