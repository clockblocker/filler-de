/**
 * The Morpheme section of a Reading note, as the codec writes it (#268):
 *
 * ```
 * <span class="note_block_title note_block_title_morpheme">Morpheme</span>
 * <span class="tf-morphemes"></span>[[Worter/…/Kohle|Kohle]]|[[…/Kraft|kraft]]|[[…|werk]]
 * [[Worter/…/Kohle|Kohle]] + [[Worter/…/Kraftwerk|Kraftwerk]]
 * ```
 *
 * The morphemes line opens with an empty `tf-morphemes` span, and each
 * `|`-separated piece after it is one morpheme: a link, or plain letters,
 * such as `ge`. A piece without a letter, such as a compound's hyphen, is a
 * Filler, and a zero ending has no letters, so the codec leaves it out. Its
 * `|` are only those outside `[[…]]`: an alias's pipe separates nothing.
 */
import {
	MORPHEMES_LINE_CLASS,
	SECTION_TITLE_CLASS,
	sectionTitleClass,
} from "@textfresser/lemma-note-codec";
import { wikilinkHelper } from "@textfresser/note-addressing";

/** The empty span the morphemes line opens with. */
export const MORPHEMES_LINE_HOOK = `<span class="${MORPHEMES_LINE_CLASS}"></span>`;

const MORPHEME_TITLE_CLASS = sectionTitleClass("morpheme");

/** A half-open range of offsets into a line. */
type LineRange = {
	readonly from: number;
	readonly to: number;
};

/** One morpheme of a morphemes line, by offsets into the line. */
export type MorphemeRange = LineRange & {
	/** What the line shows of it: a link's alias, or the letters. */
	readonly shown: LineRange;
};

const hasLetter = (text: string) => /\p{L}/u.test(text);

/**
 * The morphemes of `line`, in order; none when `line` is no morphemes line.
 * A piece spans its whole link, `[[` to `]]`, so pointing at the target of
 * a link source mode shows finds it, while `shown` is its alias.
 */
export function morphemesOf(line: string): MorphemeRange[] {
	if (!line.startsWith(MORPHEMES_LINE_HOOK)) return [];
	const links = wikilinkHelper.parseWithRanges(line);
	const morphemes: MorphemeRange[] = [];
	let from = MORPHEMES_LINE_HOOK.length;
	const cut = (to: number) => {
		const piece = morphemeIn(line, from, to, links);
		if (piece) morphemes.push(piece);
		from = to + 1;
	};
	for (let at = from; at < line.length; at++) {
		const link = links.find(({ end, start }) => start <= at && at < end);
		if (link) at = link.end - 1;
		else if (line[at] === "|") cut(at);
	}
	cut(line.length);
	return morphemes;
}

type LinkRange = ReturnType<typeof wikilinkHelper.parseWithRanges>[number];

/** The morpheme `line` holds from `from` to `to`, unless it is a Filler. */
function morphemeIn(
	line: string,
	from: number,
	to: number,
	links: readonly LinkRange[],
): MorphemeRange | null {
	const text = line.slice(from, to);
	const start = from + (text.length - text.trimStart().length);
	const end = to - (text.length - text.trimEnd().length);
	if (start >= end) return null;
	const link = links.find(
		(candidate) => candidate.start === start && candidate.end === end,
	);
	if (link)
		return {
			from: start,
			shown:
				link.alias === null
					? { from: start + 2, to: end - 2 }
					: { from: start + 2 + link.target.length + 1, to: end - 2 },
			to: end,
		};
	return hasLetter(line.slice(start, end))
		? { from: start, shown: { from: start, to: end }, to: end }
		: null;
}

/** The morpheme of `line` whose piece `offset` lies in, if any. */
export const morphemeAt = (
	line: string,
	offset: number,
): MorphemeRange | undefined =>
	morphemesOf(line).find(({ from, to }) => from <= offset && offset < to);

/** Whether `line` is a section's title line, and whether the Morpheme one. */
function titleOf(line: string): "Morpheme" | "Other" | null {
	if (!line.includes(`class="${SECTION_TITLE_CLASS} `)) return null;
	return line.includes(MORPHEME_TITLE_CLASS) ? "Morpheme" : "Other";
}

/**
 * Which of `lines`, a paragraph's, belong to a Morpheme section: from its
 * title, or from a morphemes line when the title is empty, up to the next
 * section's title. A Locution has no morphemes line, only its wording.
 */
export function morphemeSectionLines(lines: readonly string[]): boolean[] {
	let inSection = false;
	return lines.map((line) => {
		const title = titleOf(line);
		if (title !== null) inSection = title === "Morpheme";
		else if (line.startsWith(MORPHEMES_LINE_HOOK)) inSection = true;
		return inSection;
	});
}

/**
 * `text` with its Morpheme section's lines blanked out, offsets kept, so
 * their links are no unit parts: the morphemes and constituents lines link
 * Lemmas, not a unit's occurrences.
 */
export function withoutMorphemeSection(text: string): string {
	const lines = text.split("\n");
	const inSection = morphemeSectionLines(lines);
	return lines
		.map((line, index) =>
			inSection[index] ? " ".repeat(line.length) : line,
		)
		.join("\n");
}

/** A run of a rendered text node: a morpheme's letters or what is between. */
export type PlainPiece = {
	readonly text: string;
	readonly morpheme: boolean;
};

/**
 * A rendered text node of a morphemes line, such as `|ge|`, split into its
 * morphemes and what is between them, up to the line's end: `rest` is what
 * follows a line break in the node, or null when it has none.
 */
export function plainPieces(text: string): {
	readonly pieces: readonly PlainPiece[];
	readonly rest: string | null;
} {
	const newline = text.indexOf("\n");
	const head = newline === -1 ? text : text.slice(0, newline);
	const pieces = head
		.split(/(\|)/u)
		.filter((piece) => piece.length > 0)
		.map((piece) => ({
			morpheme: piece !== "|" && hasLetter(piece),
			text: piece,
		}));
	return { pieces, rest: newline === -1 ? null : text.slice(newline) };
}

/** The parts of a DOM node the rendered section's walk reads. */
type SectionNode = Pick<Node, "nodeType" | "parentNode" | "previousSibling">;

const isElement = (node: SectionNode): node is SectionNode & Element =>
	node.nodeType === 1;

/**
 * Whether the rendered `node` stands in `block`'s Morpheme section, as
 * `morphemeSectionLines` reads the text: Reading view renders a paragraph's
 * lines as one block's children, the title spans among them.
 */
export function inRenderedMorphemeSection(
	node: SectionNode,
	block: SectionNode,
): boolean {
	let child = node;
	while (child.parentNode && child.parentNode !== block)
		child = child.parentNode;
	for (let at = child.previousSibling; at; at = at.previousSibling) {
		if (!isElement(at)) continue;
		if (at.classList.contains(MORPHEMES_LINE_CLASS)) return true;
		if (at.classList.contains(SECTION_TITLE_CLASS))
			return at.classList.contains(MORPHEME_TITLE_CLASS);
	}
	return false;
}
