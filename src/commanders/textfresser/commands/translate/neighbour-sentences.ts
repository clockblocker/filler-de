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

export function neighbourSentences(
	input: NeighbourSentencesInput,
): NeighbourSentences {
	const { body } = noteMetadataHelper.decompose(input.content);
	const span = locate(body, input);
	if (!span) return {};
	const before = sentencesOf(body.slice(0, span.start)).findLast(hasLetter);
	const after = sentencesOf(body.slice(span.end)).find(hasLetter);
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

/** The text's Sentences, without block IDs, links or inline markup. */
function sentencesOf(text: string): readonly string[] {
	const plain = text
		.split("\n")
		.map((line) =>
			markdownHelper.stripAll(blockIdHelper.stripFromEnd(line)),
		)
		.join("\n");
	return splitScroll(extractPastedText(plain)).paragraphs.flatMap(
		({ sentences }) => sentences,
	);
}

/** Leaves out what is left of a Sentence's end, such as a lone period. */
const hasLetter = (sentence: string) => /\p{L}/u.test(sentence);
