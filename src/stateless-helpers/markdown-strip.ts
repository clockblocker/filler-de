/**
 * Markdown stripping utilities for context display.
 */

/**
 * Remove comments (%%...%% → removed entirely).
 */
function stripComments(text: string): string {
	return text.replace(/%%[^%]*%%/g, "");
}

/**
 * Remove bold+italic markers (***text*** → text).
 * Must run before bold/italic.
 */
function stripBoldItalic(text: string): string {
	return text.replace(/\*{3}([^*]+)\*{3}/g, "$1");
}

/**
 * Remove bold markers (**text** or __text__ → text).
 */
function stripBold(text: string): string {
	return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
}

/**
 * Remove italic markers (*text* or _text_ → text).
 * Must run after bold to avoid conflicts.
 */
function stripItalic(text: string): string {
	return text.replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1");
}

/**
 * Remove strikethrough markers (~~text~~ → text).
 */
function stripStrikethrough(text: string): string {
	return text.replace(/~~([^~]+)~~/g, "$1");
}

/**
 * Remove highlight markers (==text== → text).
 */
function stripHighlight(text: string): string {
	return text.replace(/==([^=]+)==/g, "$1");
}

/**
 * Remove inline code markers (`text` → text).
 */
function stripInlineCode(text: string): string {
	return text.replace(/`([^`]+)`/g, "$1");
}

/**
 * Replace embeds with their target (![[embed]] → embed).
 * Must run before wikilinks.
 */
function replaceEmbeds(text: string): string {
	return text.replace(/!\[\[([^\]]+)\]\]/g, "$1");
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
 * Replace external links with their text ([text](url) → text).
 */
function replaceExternalLinks(text: string): string {
	return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/**
 * Remove HTML tags (<u>, <sup>, <sub> → content).
 */
function stripHtmlTags(text: string): string {
	return text
		.replace(/<u>([^<]*)<\/u>/gi, "$1")
		.replace(/<sup>([^<]*)<\/sup>/gi, "$1")
		.replace(/<sub>([^<]*)<\/sub>/gi, "$1");
}

/**
 * Strip all markdown formatting for context display.
 * Order matters to avoid conflicts.
 */
function stripAll(text: string): string {
	let result = text;
	result = stripComments(result);
	result = stripBoldItalic(result);
	result = stripBold(result);
	result = stripItalic(result);
	result = stripStrikethrough(result);
	result = stripHighlight(result);
	result = stripInlineCode(result);
	result = replaceEmbeds(result);
	result = replaceWikilinks(result);
	result = replaceExternalLinks(result);
	result = stripHtmlTags(result);
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
};
