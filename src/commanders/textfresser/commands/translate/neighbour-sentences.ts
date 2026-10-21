/**
 * The Sentences around the text Translate sends to dumgen, which
 * `translate.sentence` reads as context only and never translates.
 *
 * The note body, without its frontmatter or metadata section, is split
 * with dumgen's own sentence splitter (`extractPastedText` then
 * `splitScroll`). `before` is the last Sentence ending before the
 * translated text and `after` the first one starting after it, across
 * blocks and paragraphs. A selection inside a Sentence therefore gets the
 * rest of that Sentence as its neighbours, which settles what the
 * selection leaves open just as well.
 *
 * Block IDs, links and inline markup are stripped line by line before the
 * split, with the translated text standing in as one mark, so a selection
 * inside a link or a bold run leaves no half of it behind. In a note whose
 * blocks carry IDs, only the lines carrying one count, besides the
 * translated text's own: the translations Translate wrote earlier sit on
 * lines without one, and are no Sentences of the text.
 *
 * The translated text is found through its block, which the note must hold
 * exactly once, or else through the selection itself, likewise once. When
 * neither is unique there are no neighbours, and Translate still runs.
 */
import {
	extractPastedText,
	splitScroll,
	type TranslateSentenceInput,
} from "dumgen";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";

export type NeighbourSentences = NonNullable<
	TranslateSentenceInput["neighbours"]
>;

export type NeighbourSentencesInput = {
	/** The whole note, as the editor holds it. */
	readonly content: string;
	/** The line holding the selection or the caret. */
	readonly block: string;
	/** The selected text, or null when Translate takes the whole block. */
	readonly selection: string | null;
	/** Where the selection starts within `block`, when known. */
	readonly selectionStartInBlock: number | null;
};

type Span = { readonly start: number; readonly end: number };

/** Stands in for the translated text; a private-use character no note holds. */
const MARK = "";

export function neighbourSentences(
	input: NeighbourSentencesInput,
): NeighbourSentences {
	const body = noteMetadataHelper.body(input.content);
	const span = locate(body, input);
	if (!span || body.includes(MARK)) return {};
	const lines =
		`${body.slice(0, span.start)}${MARK}${body.slice(span.end)}`.split(
			"\n",
		);
	const onlyBlocks = lines.some(hasBlockId);
	const plain = lines
		.filter(
			(line) =>
				!onlyBlocks ||
				line.trim() === "" ||
				line.includes(MARK) ||
				hasBlockId(line),
		)
		.map((line) =>
			markdownHelper.stripAll(blockIdHelper.stripFromEnd(line)),
		)
		.join("\n");
	const at = plain.indexOf(MARK);
	if (at === -1) return {};
	const before = sentencesOf(plain.slice(0, at)).findLast(hasLetter);
	const after = sentencesOf(plain.slice(at + MARK.length)).find(hasLetter);
	return {
		...(before === undefined ? {} : { before }),
		...(after === undefined ? {} : { after }),
	};
}

function locate(
	body: string,
	{ block, selection, selectionStartInBlock }: NeighbourSentencesInput,
): Span | undefined {
	const blockStart = onlyIndexOf(body, block);
	if (selection === null)
		return blockStart === undefined
			? undefined
			: { end: blockStart + block.length, start: blockStart };
	if (
		blockStart !== undefined &&
		selectionStartInBlock !== null &&
		selectionStartInBlock >= 0 &&
		block.startsWith(selection, selectionStartInBlock)
	) {
		const start = blockStart + selectionStartInBlock;
		return { end: start + selection.length, start };
	}
	const start = onlyIndexOf(body, selection);
	return start === undefined
		? undefined
		: { end: start + selection.length, start };
}

/** Where `part` stands in `text`, if it stands there exactly once. */
function onlyIndexOf(text: string, part: string): number | undefined {
	if (part.trim() === "") return undefined;
	const index = text.indexOf(part);
	return index !== -1 && index === text.lastIndexOf(part) ? index : undefined;
}

const hasBlockId = (line: string) =>
	blockIdHelper.extractFromLine(line) !== null;

function sentencesOf(text: string): readonly string[] {
	return splitScroll(extractPastedText(text)).paragraphs.flatMap(
		({ sentences }) => sentences,
	);
}

/** Leaves out what is left of a Sentence's end, such as a lone period. */
const hasLetter = (sentence: string) => /\p{L}/u.test(sentence);
