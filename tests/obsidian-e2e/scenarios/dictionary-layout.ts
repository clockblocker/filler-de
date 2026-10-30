/**
 * What every dictionary note looks like under ADR-0015, for the scenarios
 * that classify: the visible layout the user reads, and the data the store
 * keeps out of it. Dictionary data never shows as an inline `%%tf…%%`
 * marker; it sits in the note-metadata facility, in the hidden section at
 * the end of the file or, with "Hide metadata" off, in the frontmatter.
 */
import { expect } from "bun:test";

/** A dictionary section's title, as the codec spells it. */
const title = (cssClass: string, shown: string) =>
	`<span class="note_block_title note_block_title_${cssClass}">${shown}</span>`;

export const TITLES = {
	begegneteFormen: title("surfaces", "Begegnete Formen"),
	definition: title("definition", "Definition"),
	deineKontexte: title("kontexte", "Deine Kontexte"),
	eintraege: title("eintraege", "Einträge"),
	flexion: title("flexion", "Flexion"),
	morpheme: title("morpheme", "Morpheme"),
	note: title("kontexte", "Note"),
	tags: title("tags", "Tags"),
	uebersetzung: title("translations", "Übersetzung"),
	wortbildung: title("formations", "Wortbildung"),
} as const;

/** Which metadata namespace each kind of dictionary note keeps its data under. */
export type DictionaryNoteKind = "crossroadNote" | "lemmaNote" | "readingNote";

const HIDDEN_SECTION =
	/\n<section id="textfresser_meta_keep_me_invisible">\n(\{.*\})\n<\/section>\n?$/su;

/** A vault path without its `.md`, as a wikilink names it. */
export const linkpath = (path: string) => path.replace(/\.md$/u, "");

/** `[[<path>|<shown>]]`. */
export const linkTo = (path: string, shown: string) =>
	`[[${linkpath(path)}|${shown}]]`;

/**
 * Asserts the note keeps its data in the hidden section that ends it, under
 * `kind`, and nowhere else: no frontmatter and no inline marker.
 */
export function expectHiddenMetadata(
	note: string | undefined,
	kind: DictionaryNoteKind,
): void {
	expect(note).toBeDefined();
	const text = note ?? "";
	expect(text.startsWith("---\n")).toBe(false);
	expect(text).not.toContain("%%tf");
	const section = HIDDEN_SECTION.exec(text);
	if (!section?.[1]) throw new Error(`No hidden metadata section ends:\n${text}`);
	expect(Object.keys(JSON.parse(section[1]) as object)).toEqual([kind]);
	expect(text.indexOf("<section")).toBe(section.index + 1);
}

/**
 * Asserts the note keeps its data in its frontmatter, under `kind`, with
 * no hidden section and no inline marker.
 */
export function expectFrontmatterMetadata(
	note: string | undefined,
	kind: DictionaryNoteKind,
): void {
	expect(note).toBeDefined();
	const text = note ?? "";
	expect(text).toStartWith(`---\n${kind}:\n`);
	expect(text.indexOf("\n---\n")).toBeGreaterThan(0);
	expect(text).not.toContain("<section");
	expect(text).not.toContain("%%tf");
}

/** The note's visible text: what the user reads, without its metadata. */
export function visible(note: string | undefined): string {
	const text = note ?? "";
	const withoutFrontmatter = text.startsWith("---\n")
		? text
				.slice(text.indexOf("\n---\n") + "\n---\n".length)
				.replace(/^\n+/u, "")
		: text;
	const hidden = HIDDEN_SECTION.exec(withoutFrontmatter);
	return (
		hidden ? withoutFrontmatter.slice(0, hidden.index) : withoutFrontmatter
	).trimEnd();
}

/** The Lemma note's lines from the table captioned `caption` to its Block ID. */
export function tableOf(
	lemmaNote: string | undefined,
	caption: string,
): { readonly blockId: string; readonly lines: readonly string[] } {
	const lines = visible(lemmaNote).split("\n");
	const start = lines.indexOf(caption);
	const end = lines.findIndex((line, at) => at > start && line.startsWith("^"));
	if (start < 0 || end < 0)
		throw new Error(`No table captioned ${caption} in:\n${lemmaNote}`);
	return {
		blockId: (lines[end] ?? "").slice(1),
		lines: lines.slice(start + 1, end),
	};
}

/** Asserts `parts` occur in `text` in this order. */
export function expectInOrder(
	text: string | undefined,
	parts: readonly string[],
): void {
	let from = 0;
	for (const part of parts) {
		const at = (text ?? "").indexOf(part, from);
		if (at < 0)
			throw new Error(
				`Expected ${JSON.stringify(part)} after offset ${from} in:\n${text}`,
			);
		from = at + part.length;
	}
}
