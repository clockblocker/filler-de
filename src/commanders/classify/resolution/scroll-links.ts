/**
 * The Scroll side of resolution (#64): where each Segment's Attestation Ref
 * points, and the one writer that links Segments to their Reading blocks.
 *
 * Resolution reads the Scroll once, as Classify read it (`snapshot`), and
 * writes long after, while the user may type. The writer therefore never
 * replays offsets blindly: it maps each edit from the snapshot onto the
 * current content through their common prefix and suffix, checks that the
 * text it would replace is still there, and leaves every edit that touches
 * the changed region alone. All of this is a pure function of the two
 * contents, so it runs inside VAM's compare-and-swap transform.
 */
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import type { SourceRange, UnitRef } from "../types";

/** Where an occurrence's Attestation Ref points: its block's ID, minted if the block has none. */
export type SourceBlock = {
	readonly id: string;
	/** Set when the block has no ID yet: the snapshot offset of its last line's end. */
	readonly mintAt?: number;
};

const LIST_ITEM_OR_HEADING = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/u;

function lineEndOf(content: string, from: number): number {
	const end = content.indexOf("\n", from);
	return end < 0 ? content.length : end;
}

/** A line without its trailing `\r`. */
function lineAt(content: string, start: number): string {
	return content.slice(start, lineEndOf(content, start)).replace(/\r$/u, "");
}

/**
 * The block an offset belongs to: from its line on to the paragraph's end,
 * the first line that carries a `^id`; a list item or heading starts a
 * block of its own. Without one, the paragraph's last line is where a new
 * ID goes.
 */
function locateBlock(
	content: string,
	offset: number,
): { readonly id: string } | { readonly mintAt: number } {
	let start = content.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
	if (offset === 0) start = 0;
	let lastEnd = lineEndOf(content, start);
	for (let first = true; start <= content.length; first = false) {
		const line = lineAt(content, start);
		if (!first && (line.trim() === "" || LIST_ITEM_OR_HEADING.test(line)))
			break;
		const id = blockIdHelper.extractFromLine(line);
		if (id) return { id };
		const end = lineEndOf(content, start);
		lastEnd = content[end - 1] === "\r" && end > start ? end - 1 : end;
		if (end >= content.length) break;
		start = end + 1;
	}
	return { mintAt: lastEnd };
}

/**
 * The source block of each offset in `content`, numbering blocks without
 * an ID after the highest `^N` the Scroll holds, one ID per block.
 */
export function sourceBlocksOf(
	content: string,
	offsets: readonly number[],
): ReadonlyMap<number, SourceBlock> {
	let next = blockIdHelper.findHighestNumber(content) + 1;
	const minted = new Map<number, string>();
	const blocks = new Map<number, SourceBlock>();
	for (const offset of offsets) {
		const located = locateBlock(content, offset);
		if ("id" in located) {
			blocks.set(offset, { id: located.id });
			continue;
		}
		let id = minted.get(located.mintAt);
		if (id === undefined) {
			id = String(next++);
			minted.set(located.mintAt, id);
		}
		blocks.set(offset, { id, mintAt: located.mintAt });
	}
	return blocks;
}

/** The Attestation Ref Lemma notes store: an embed of the Scroll's block. */
export function attestationRefOf(scrollPath: string, blockId: string): string {
	const file = scrollPath.split("/").at(-1) ?? scrollPath;
	const basename = file.endsWith(".md") ? file.slice(0, -3) : file;
	return blockIdHelper.formatEmbed(basename, blockId);
}

/** A Reading block a unit links to. */
export type LinkTarget = {
	/** The Lemma note's vault path, `.md` included. */
	readonly lemmaPath: string;
	/** The Reading's block ID, without `^`. */
	readonly readingBlockId: string;
};

/** One unit's links: every piece of it, located in the snapshot. */
export type UnitLinkEdit = {
	readonly ref: UnitRef;
	readonly target: LinkTarget;
	readonly occurrences: readonly SourceRange[];
};

/** A block ID the Attestation Refs name and the Scroll still lacks. */
export type BlockIdMint = {
	/** The snapshot offset of the block's last line end. */
	readonly at: number;
	readonly id: string;
};

export type SkippedLink = {
	readonly ref: UnitRef;
	readonly text: string;
	readonly reason: string;
};

export type LinkedScroll = {
	readonly content: string;
	/** Per edit, in order: how many of its occurrences were linked. */
	readonly linked: readonly number[];
	readonly skipped: readonly SkippedLink[];
	readonly mintsSkipped: readonly BlockIdMint[];
};

/** `[[Worter/…/See#^r-…|See]]`: the path-qualified link to a Reading block. */
export function readingLink(target: LinkTarget, shown: string): string {
	const path = target.lemmaPath.endsWith(".md")
		? target.lemmaPath.slice(0, -3)
		: target.lemmaPath;
	return `[[${path}#^${target.readingBlockId}|${shown}]]`;
}

/**
 * How snapshot offsets map onto the current content. A range outside the
 * region between their common prefix and suffix moves with it; one inside
 * it moves with its line, when that line occurs exactly once in the current
 * content, so typing elsewhere in the Scroll leaves it linkable.
 */
function offsetMapper(snapshot: string, current: string) {
	const shortest = Math.min(snapshot.length, current.length);
	let prefix = 0;
	while (prefix < shortest && snapshot[prefix] === current[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < shortest - prefix &&
		snapshot[snapshot.length - 1 - suffix] ===
			current[current.length - 1 - suffix]
	)
		suffix++;
	const changedEnd = snapshot.length - suffix;
	const delta = current.length - snapshot.length;
	/** The shift of the line holding `[from, to)`, if it is one line found once. */
	const lineShift = (from: number, to: number): number | undefined => {
		const start = snapshot.lastIndexOf("\n", from - 1) + 1;
		const end = lineEndOf(snapshot, start);
		if (to > end) return undefined;
		const line = snapshot.slice(start, end);
		if (!line.trim()) return undefined;
		let found: number | undefined;
		for (
			let at = current.indexOf(line);
			at >= 0;
			at = current.indexOf(line, at + 1)
		) {
			const whole =
				(at === 0 || current[at - 1] === "\n") &&
				(at + line.length === current.length ||
					current[at + line.length] === "\n");
			if (!whole) continue;
			if (found !== undefined) return undefined;
			found = at;
		}
		return found === undefined ? undefined : found - start;
	};
	return {
		point(at: number): number | undefined {
			if (at <= prefix) return at;
			if (at >= changedEnd) return at + delta;
			const shift = lineShift(at, at);
			return shift === undefined ? undefined : at + shift;
		},
		range(range: SourceRange): SourceRange | undefined {
			if (range.to <= prefix) return range;
			if (range.from >= changedEnd)
				return { from: range.from + delta, to: range.to + delta };
			const shift = lineShift(range.from, range.to);
			return shift === undefined
				? undefined
				: { from: range.from + shift, to: range.to + shift };
		},
	};
}

const LINKISH =
	/!?\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]|!?\[[^\]\n]*\]\([^)\n]*\)/gu;

/**
 * What to replace for an occurrence at `range`: the range itself, or a
 * whole wikilink whose shown text it is exactly, so links never nest. An
 * occurrence inside an embed, a Markdown link or only part of a wikilink's
 * shown text is left alone.
 */
function replaceableSpan(
	content: string,
	range: SourceRange,
): SourceRange | string {
	const lineStart = content.lastIndexOf("\n", range.from - 1) + 1;
	const line = content.slice(lineStart, lineEndOf(content, range.from));
	LINKISH.lastIndex = 0;
	for (let match = LINKISH.exec(line); match; match = LINKISH.exec(line)) {
		const from = lineStart + match.index;
		const to = from + match[0].length;
		if (to <= range.from || from >= range.to) continue;
		const [whole, target, alias] = match;
		if (whole.startsWith("!") || target === undefined)
			return "inside an embed or a Markdown link";
		const shownFrom =
			alias === undefined ? from + 2 : from + whole.indexOf("|") + 1;
		const hash = target.indexOf("#");
		const shownTo =
			alias === undefined
				? from + 2 + (hash < 0 ? target.length : hash)
				: to - 2;
		if (shownFrom === range.from && shownTo === range.to)
			return { from, to };
		return "inside another link";
	}
	return range;
}

/**
 * Links every occurrence of every edit in `current`, and appends each
 * still-missing block ID, wherever the snapshot's text is still in place.
 */
export function linkUnitsInScroll(input: {
	readonly snapshot: string;
	readonly current: string;
	readonly edits: readonly UnitLinkEdit[];
	readonly mints: readonly BlockIdMint[];
}): LinkedScroll {
	const { current, snapshot } = input;
	const map = offsetMapper(snapshot, current);
	type Replacement = SourceRange & {
		readonly text: string;
		readonly edit?: number;
	};
	const replacements: Replacement[] = [];
	const skipped: SkippedLink[] = [];
	const linked = input.edits.map(() => 0);
	for (const [index, edit] of input.edits.entries()) {
		for (const occurrence of edit.occurrences) {
			const text = snapshot.slice(occurrence.from, occurrence.to);
			const skip = (reason: string) =>
				skipped.push({ reason, ref: edit.ref, text });
			if (!text.trim() || /[[\]|\n\r]/u.test(text)) {
				skip("its text cannot be a link's shown text");
				continue;
			}
			const moved = map.range(occurrence);
			// The text and the characters around it, so a word never links
			// as part of a longer one the user typed it into.
			if (
				!moved ||
				current.slice(moved.from, moved.to) !== text ||
				current[moved.from - 1] !== snapshot[occurrence.from - 1] ||
				current[moved.to] !== snapshot[occurrence.to]
			) {
				skip("the text changed since Classify read it");
				continue;
			}
			const span = replaceableSpan(current, moved);
			if (typeof span === "string") {
				skip(span);
				continue;
			}
			if (
				replacements.some(
					(other) => other.from < span.to && other.to > span.from,
				)
			) {
				skip("another unit's link covers it");
				continue;
			}
			replacements.push({
				...span,
				edit: index,
				text: readingLink(edit.target, text),
			});
		}
	}
	const mintsSkipped: BlockIdMint[] = [];
	for (const mint of input.mints) {
		const at = map.point(mint.at);
		const lineStart =
			at === undefined ? 0 : current.lastIndexOf("\n", at - 1) + 1;
		const atLineEnd =
			at !== undefined &&
			(at === current.length ||
				current[at] === "\n" ||
				current[at] === "\r");
		if (
			at === undefined ||
			!atLineEnd ||
			blockIdHelper.extractFromLine(current.slice(lineStart, at)) !==
				null ||
			replacements.some((other) => other.from < at && other.to > at)
		) {
			mintsSkipped.push(mint);
			continue;
		}
		replacements.push({ from: at, text: ` ^${mint.id}`, to: at });
	}
	let content = current;
	for (const replacement of [...replacements].sort(
		(a, b) => b.from - a.from || b.to - a.to,
	)) {
		content =
			content.slice(0, replacement.from) +
			replacement.text +
			content.slice(replacement.to);
		if (replacement.edit !== undefined)
			linked[replacement.edit] = (linked[replacement.edit] ?? 0) + 1;
	}
	return { content, linked, mintsSkipped, skipped };
}
