/**
 * The hidden metadata section: the format "Hide metadata" selects.
 *
 * ```
 * <body, trailing whitespace trimmed>
 * <20 newlines of padding>
 * <section id="textfresser_meta_keep_me_invisible">
 * <the metadata document, as one line of escaped JSON>
 * </section>
 * ```
 *
 * The section counts only when it ends the file, trailing whitespace aside.
 * A section-shaped string anywhere else, or one followed by text, is visible
 * content and is never read as data.
 */

import { Predicate } from "effect";
import type { MetadataDocument } from "./document";

const SECTION_ID = "textfresser_meta_keep_me_invisible";
const OPEN_TAG = `<section id="${SECTION_ID}">`;
const CLOSE_TAG = "</section>";

/** Blank lines that push the section below the visible part of the note. */
export const HIDDEN_SECTION_PADDING = "\n".repeat(20);

/**
 * From an opening tag to the end of the file: the payload, the closing tag,
 * then only whitespace. The payload match is greedy, so a legacy payload
 * holding an unescaped `</section>` still reaches the real closing tag.
 */
const ANCHORED_SECTION = new RegExp(
	`^${OPEN_TAG}([\\s\\S]*)${CLOSE_TAG}\\s*$`,
	"u",
);

/** An opening bracket directly followed by another. */
const NESTED_OPENING_BRACKET = /\[(?=\[)/gu;

/** A JSON string token, escapes included. */
const JSON_STRING = /"(?:[^"\\]|\\.)*"/gu;

export type LocatedHiddenSection = {
	/** Index of the opening tag. */
	readonly start: number;
	readonly document: MetadataDocument;
};

/**
 * The section that ends `content`, or null.
 *
 * Tries opening tags from the last one back, so a legacy payload that holds
 * the opening tag as text does not hide the section it sits in. A candidate
 * counts only when everything from it to the end of the file is one section
 * whose payload is a JSON object.
 */
export function locateHiddenSection(
	content: string,
): LocatedHiddenSection | null {
	let from = content.length;
	while (from >= 0) {
		const start = content.lastIndexOf(OPEN_TAG, from);
		if (start < 0) return null;
		const document = parseCandidate(content.slice(start));
		if (document) return { document, start };
		from = start - 1;
	}
	return null;
}

function parseCandidate(tail: string): MetadataDocument | null {
	const payload = ANCHORED_SECTION.exec(tail)?.[1];
	if (payload === undefined) return null;
	try {
		const parsed: unknown = JSON.parse(payload.trim());
		return Predicate.isObject(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Writes `document` as JSON on one line. Inside its strings:
 * - `[` becomes `\u005b`, so no value holds a wikilink, an embed or a
 *   Markdown link for Obsidian to render or index;
 * - `%` becomes `\u0025`, so no value opens an Obsidian comment;
 * - `<` becomes `\u003c`, so no value closes the section or opens a tag;
 * - `#` becomes `\u0023`, so no value is indexed as a tag.
 *
 * Between strings, a space separates the brackets of nested arrays, so
 * `[[` never appears at all.
 *
 * Both are plain JSON, so `JSON.parse` reads the values back unchanged, and
 * sections written before escaping still parse.
 */
export function formatHiddenSection(document: MetadataDocument): string {
	const json = JSON.stringify(document);
	let escaped = "";
	let last = 0;
	for (const match of json.matchAll(JSON_STRING)) {
		escaped += separateBrackets(json.slice(last, match.index));
		escaped += escapeString(match[0]);
		last = match.index + match[0].length;
	}
	escaped += separateBrackets(json.slice(last));
	return `${OPEN_TAG}\n${escaped}\n${CLOSE_TAG}`;
}

function escapeString(token: string): string {
	return token
		.replaceAll("[", "\\u005b")
		.replaceAll("%", "\\u0025")
		.replaceAll("<", "\\u003c")
		.replaceAll("#", "\\u0023");
}

function separateBrackets(structure: string): string {
	return structure.replace(NESTED_OPENING_BRACKET, "[ ");
}
