/**
 * Markdown stripping utilities for context display.
 */

/**
 * Remove bold markers (**text** → text).
 */
function stripBold(text: string): string {
	return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

/**
 * Remove block references at end of line ( ^id → removed).
 */
function stripBlockRefs(text: string): string {
	return text.replace(/\s\^[a-zA-Z0-9-]+\s*$/, "");
}

/**
 * Replace wikilinks with their surface text.
 * [[target]] → target
 * [[target|alias]] → alias
 */
function replaceWikilinks(text: string): string {
	return text.replace(
		/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
		(_, target, alias) => alias ?? target,
	);
}

/**
 * Strip all markdown formatting for context display.
 * Removes bold, block refs, replaces wikilinks with surface.
 */
function stripAll(text: string): string {
	let result = text;
	result = stripBold(result);
	result = replaceWikilinks(result);
	result = stripBlockRefs(result);
	return result;
}

/**
 * Markdown stripping helper object with grouped functions.
 */
export const markdownHelper = {
	replaceWikilinks,
	stripAll,
	stripBlockRefs,
	stripBold,
};
