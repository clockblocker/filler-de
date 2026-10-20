/**
 * Finds an old attestation's Segment again (#65): the block its embed
 * names in the source Scroll, and inside that block the text of the
 * headword, or of a form the old note listed. The range it answers is a
 * selection Classify can run over. It is pure, so Dry run and Execute
 * locate alike, and Execute locates again on the Scroll as it is then.
 */
import type { SourceRange } from "../classify/types";
import { linkBasename } from "./old-notes";

export type LocatedAttestation =
	| {
			readonly _tag: "Located";
			readonly selection: SourceRange;
			/** The text the selection covers. */
			readonly text: string;
			/** Whether a wikilink named the form, or it was found in the text. */
			readonly via: "Link" | "Text";
			/** How many lines carry the block ID; the first one is used. */
			readonly blockIdLines: number;
	  }
	| { readonly _tag: "BlockMissing" }
	| { readonly _tag: "FormMissing"; readonly blockText: string };

const escapeRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** A line's block ID, as Obsidian reads one: after whitespace, at its end. */
const blockIdPattern = (id: string) =>
	new RegExp(String.raw`(?:^|\s)\^${escapeRegExp(id)}\s*$`, "u");

type Line = { readonly from: number; readonly text: string };

function linesOf(content: string): Line[] {
	const lines: Line[] = [];
	let from = 0;
	for (const text of content.split("\n")) {
		lines.push({ from, text: text.replace(/\r$/u, "") });
		from += text.length + 1;
	}
	return lines;
}

const breaksParagraph = (text: string) =>
	text.trim() === "" ||
	/^\s*(?:```|~~~|#{1,6}\s|[-*+]\s|\d+[.)]\s)/u.test(text);

/**
 * The block a block ID names: the line that carries it and the lines of
 * its paragraph above, up to a blank line, heading or list item.
 */
export function findBlock(
	content: string,
	blockId: string,
): { readonly range: SourceRange; readonly idLines: number } | undefined {
	const lines = linesOf(content);
	const pattern = blockIdPattern(blockId);
	const carrying = lines.flatMap((line, index) =>
		pattern.test(line.text) ? [index] : [],
	);
	const at = carrying[0];
	if (at === undefined) return undefined;
	const idLine = lines[at];
	if (!idLine) return undefined;
	let first = at;
	if (!/^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)/u.test(idLine.text))
		while (first > 0) {
			const above = lines[first - 1];
			if (!above || breaksParagraph(above.text)) break;
			first--;
		}
	const start = lines[first]?.from ?? idLine.from;
	const marker = pattern.exec(idLine.text);
	const end = idLine.from + (marker ? marker.index : idLine.text.length);
	return { idLines: carrying.length, range: { from: start, to: end } };
}

/** Wikilinks and embeds with where their shown text is, if they show any. */
const LINK = /(!?)\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]/gu;

type LinkSpan = {
	readonly from: number;
	readonly to: number;
	readonly target: string;
	/** The shown text's range; none for an embed. */
	readonly shown: SourceRange | undefined;
};

function linksIn(text: string, offset: number): LinkSpan[] {
	return [...text.matchAll(LINK)].map((match) => {
		const [whole, bang, target = "", alias] = match;
		const from = offset + (match.index ?? 0);
		const to = from + whole.length;
		if (bang) return { from, shown: undefined, target, to };
		if (alias !== undefined)
			return {
				from,
				shown: { from: from + whole.indexOf("|") + 1, to: to - 2 },
				target,
				to,
			};
		const hash = target.indexOf("#");
		return {
			from,
			shown: {
				from: from + 2,
				to: from + 2 + (hash < 0 ? target.length : hash),
			},
			target,
			to,
		};
	});
}

/** Letters and digits in any script, for whole-word matches. */
const WORD = /[\p{L}\p{N}]/u;

/**
 * Locates an attestation's Segment: in the block `blockId` names, the
 * shown text of a wikilink to one of `forms`, else the first whole-word
 * occurrence of one in the block's visible text. Forms are tried in order,
 * each first as written, then ignoring case.
 */
export function locateAttestation(
	content: string,
	blockId: string,
	forms: readonly string[],
): LocatedAttestation {
	const block = findBlock(content, blockId);
	if (!block) return { _tag: "BlockMissing" };
	const { range } = block;
	const text = content.slice(range.from, range.to);
	const links = linksIn(text, range.from);
	const located = (selection: SourceRange, via: "Link" | "Text") =>
		({
			_tag: "Located",
			blockIdLines: block.idLines,
			selection,
			text: content.slice(selection.from, selection.to),
			via,
		}) as const;
	const same = (left: string, right: string, folded: boolean) =>
		folded ? left.toLowerCase() === right.toLowerCase() : left === right;

	for (const folded of [false, true])
		for (const form of forms) {
			const hit = links.find(
				(link) =>
					link.shown !== undefined &&
					same(
						linkBasename(link.target.split("#")[0] ?? ""),
						form,
						folded,
					),
			);
			if (hit?.shown && hit.shown.to > hit.shown.from)
				return located(hit.shown, "Link");
		}

	// Only text a reader sees: link markup and embeds are blanked out, unit
	// for unit, so offsets stay those of the block.
	const hidden = new Set<number>();
	for (const link of links)
		for (let at = link.from; at < link.to; at++)
			if (!link.shown || at < link.shown.from || at >= link.shown.to)
				hidden.add(at - range.from);
	let masked = "";
	for (let at = 0; at < text.length; at++)
		masked += hidden.has(at) ? " " : (text[at] ?? " ");
	for (const folded of [false, true])
		for (const form of forms) {
			if (!form) continue;
			const pattern = new RegExp(
				escapeRegExp(form),
				folded ? "giu" : "gu",
			);
			for (const match of masked.matchAll(pattern)) {
				const at = match.index ?? 0;
				const end = at + match[0].length;
				const before = masked.slice(0, at).at(-1) ?? "";
				const after = masked.slice(end).at(0) ?? "";
				if (WORD.test(before) || WORD.test(after)) continue;
				return located(
					{ from: range.from + at, to: range.from + end },
					"Text",
				);
			}
		}
	return { _tag: "FormMissing", blockText: text };
}
