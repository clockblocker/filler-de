import {
	type NoteBlock,
	parseDocument,
	serializeDocument,
} from "@textfresser/lemma-note-codec";

/** What placing freeform text into a Lemma note came to. */
export type FreeformInsert =
	| { readonly _tag: "Inserted"; readonly content: string }
	| { readonly _tag: "AlreadyThere" }
	| { readonly _tag: "Refused"; readonly reason: string };

/** A line the codec would read as a Block or part marker. */
const MARKER_LIKE = /^%%tf(?:-part)?:/u;

/** Text without CRs, blank edge lines and trailing whitespace. */
export function normalizeFreeform(text: string): string {
	return text
		.replace(/\r\n?/gu, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/u, ""))
		.join("\n")
		.replace(/^\n+|\n+$/gu, "");
}

/**
 * Whether `body` is whole paragraphs of `held`: all of it, or a run of it
 * between blank lines. Freeform text placed next to other freeform text
 * parses back as one Block, so a placement is found again this way, while a
 * short text inside a longer paragraph is not mistaken for it.
 */
function holdsParagraphs(held: string, body: string): boolean {
	return (
		held === body ||
		held.startsWith(`${body}\n\n`) ||
		held.endsWith(`\n\n${body}`) ||
		held.includes(`\n\n${body}\n\n`)
	);
}

const freeformTexts = (blocks: readonly NoteBlock[]) =>
	blocks.flatMap((block) =>
		block.type === "freeform" ? [normalizeFreeform(block.raw)] : [],
	);

/**
 * Places `text` as one freeform Block at the end of the part of the Reading
 * whose Block ID is `readingBlockId`, or of the Lemma part when there is no
 * such Reading. Every other byte of the note stays as it was. Text that is
 * already a freeform Block of the note is not added twice, and text with a
 * line the codec would read as a marker is refused.
 */
export function insertFreeformBlock(
	content: string,
	readingBlockId: string | undefined,
	text: string,
): FreeformInsert {
	const body = normalizeFreeform(text);
	if (body.trim() === "")
		return { _tag: "Refused", reason: "the text is empty" };
	if (body.split("\n").some((line) => MARKER_LIKE.test(line.trimStart())))
		return {
			_tag: "Refused",
			reason: "a line of it reads as a Lemma note Block marker",
		};
	const document = parseDocument(content);
	const existing = [
		...freeformTexts(document.preamble),
		...document.parts.flatMap((part) => freeformTexts(part.blocks)),
	];
	if (existing.some((held) => holdsParagraphs(held, body)))
		return { _tag: "AlreadyThere" };

	const { parts } = document;
	let at =
		readingBlockId === undefined
			? -1
			: parts.findIndex(
					(part) =>
						part.scope === "reading" &&
						part.blockId === readingBlockId,
				);
	if (at < 0) at = parts.findIndex((part) => part.scope === "lemma");
	if (at < 0)
		return { _tag: "Refused", reason: "the note has no Lemma part" };

	const before = serializeDocument({
		parts: parts.slice(0, at + 1),
		preamble: document.preamble,
	});
	const after = serializeDocument({
		parts: parts.slice(at + 1),
		preamble: [],
	});
	// A blank line before the text ends the Block above; one after it
	// separates it from the next part's marker.
	const separated = before.endsWith("\n\n")
		? before
		: before.endsWith("\n")
			? `${before}\n`
			: `${before}\n\n`;
	return {
		_tag: "Inserted",
		content: `${separated}${body}\n${after.length > 0 ? `\n${after}` : ""}`,
	};
}

/** Whether `text` stands in one of the note's freeform Blocks, as parsed back. */
export function holdsFreeformBlock(content: string, text: string): boolean {
	const body = normalizeFreeform(text);
	const document = parseDocument(content);
	return [
		...freeformTexts(document.preamble),
		...document.parts.flatMap((part) => freeformTexts(part.blocks)),
	].some((held) => holdsParagraphs(held, body));
}
