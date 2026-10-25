/**
 * Which links are the parts of one unit: Classify links each piece of a
 * unit, such as `fängt … an`, to the unit's Reading note under `Worter/`,
 * as `[[Worter/…/🚀 anfangen|fängt]] … [[Worter/…/🚀 anfangen|an]]`, so its
 * parts are the links of one paragraph with the same target. Links carry
 * nothing of the occurrence, so two occurrences of one Reading in a
 * paragraph read as one unit.
 */
import { WORTER_FOLDER } from "@textfresser/lemma-note-codec";
import { wikilinkHelper } from "@textfresser/note-addressing";

/** A half-open range of offsets. */
export type PartRange = {
	readonly from: number;
	readonly to: number;
};

/** Whether a link to `target` is one of Classify's links to a Reading note. */
export const isUnitLinkTarget = (target: string): boolean =>
	target.startsWith(`${WORTER_FOLDER}/`);

/**
 * The shown text of every `Worter/` wikilink in `text` with the target of
 * the one `offset` lies in, in order; none when `offset` lies in no such
 * link. Embeds are no parts.
 */
export function unitPartsAt(text: string, offset: number): PartRange[] {
	const links = wikilinkHelper
		.parseWithRanges(text)
		.filter(
			({ start, target }) =>
				text[start - 1] !== "!" && isUnitLinkTarget(target),
		);
	const hovered = links.find(
		({ end, start }) => start <= offset && offset < end,
	);
	if (!hovered) return [];
	return links
		.filter(({ target }) => target === hovered.target)
		.map(({ alias, end, start, target }) =>
			alias === null
				? { from: start + 2, to: end - 2 }
				: { from: start + 2 + target.length + 1, to: end - 2 },
		);
}

/** A document by its lines, as CodeMirror's `Text` reads one. */
export type LineSource = {
	readonly lines: number;
	line(number: number): { readonly from: number; readonly text: string };
	lineAt(offset: number): { readonly number: number };
};

/**
 * The paragraph `offset` lies in: its line and the lines around it up to a
 * blank one, from where it starts.
 */
export function paragraphAt(
	doc: LineSource,
	offset: number,
): { readonly from: number; readonly text: string } {
	const filled = (number: number) => doc.line(number).text.trim() !== "";
	let first = doc.lineAt(offset).number;
	let last = first;
	while (first > 1 && filled(first - 1)) first--;
	while (last < doc.lines && filled(last + 1)) last++;
	const lines: string[] = [];
	for (let number = first; number <= last; number++)
		lines.push(doc.line(number).text);
	return { from: doc.line(first).from, text: lines.join("\n") };
}
