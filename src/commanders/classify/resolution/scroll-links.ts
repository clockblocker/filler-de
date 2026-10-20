/**
 * The Scroll side of resolution (#64): where each Segment's Attestation Ref
 * points, and the writes that give blocks their IDs and link Segments to
 * their Reading blocks.
 *
 * Resolution reads the Scroll once, as Classify read it (`snapshot`), and
 * writes later, while the user may type. The writers therefore never replay
 * offsets blindly: they map each edit from the snapshot onto the current
 * content through their common prefix and suffix, or through its line when
 * that line occurs once, check that the text they would replace is still
 * there, and leave every other edit alone. All of it is a pure function of
 * the two contents, so it runs inside VAM's compare-and-swap transform.
 *
 * Markdown that a link or a block ID would break is left alone: code spans
 * and fences, table rows, emphasis inside an occurrence, embeds, Markdown
 * links, and wikilinks the user wrote. Only the plugin's own links to
 * `Worter/` are re-pointed.
 */
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import type { SourceRange, UnitRef } from "../types";

/** The folder every link Classify writes points into (ADR 0013). */
const DICTIONARY_PREFIX = "Worter/";

const LIST_ITEM_OR_HEADING = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/u;
const FENCE = /^\s*(?:```|~~~)/u;
const TABLE_ROW = /^\s*\|/u;

function lineEndOf(content: string, from: number): number {
	const end = content.indexOf("\n", from);
	return end < 0 ? content.length : end;
}

const lineStartOf = (content: string, offset: number): number =>
	offset <= 0 ? 0 : content.lastIndexOf("\n", offset - 1) + 1;

/** A line without its trailing `\r`. */
function lineAt(content: string, start: number): string {
	return content.slice(start, lineEndOf(content, start)).replace(/\r$/u, "");
}

/** Whether `offset` lies in a fenced code block. */
function inFence(content: string, offset: number): boolean {
	const start = lineStartOf(content, offset);
	let open = false;
	for (const line of content.slice(0, start).split("\n"))
		if (FENCE.test(line)) open = !open;
	return open || FENCE.test(lineAt(content, start));
}

/** Why Markdown structure forbids touching `range`, if it does. */
function structureAround(
	content: string,
	range: SourceRange,
): string | undefined {
	const start = lineStartOf(content, range.from);
	const line = lineAt(content, start);
	if (inFence(content, range.from)) return "inside a code block";
	if (TABLE_ROW.test(line)) return "inside a table";
	const ticks = (content.slice(start, range.from).match(/`/gu) ?? []).length;
	if (ticks % 2 === 1) return "inside inline code";
	return undefined;
}

/** Where an occurrence's Attestation Ref points. */
export type SourceBlock =
	| { readonly _tag: "Identified"; readonly id: string }
	/** The block has no ID yet; one goes at the end of its last line. */
	| { readonly _tag: "Unidentified"; readonly mintAt: number }
	/** The block cannot carry an ID: a table or code. */
	| { readonly _tag: "Unaddressable"; readonly reason: string };

const breaksBlock = (line: string) =>
	line.trim() === "" ||
	LIST_ITEM_OR_HEADING.test(line) ||
	FENCE.test(line) ||
	TABLE_ROW.test(line);

/**
 * The block `offset` belongs to: from its line on to the paragraph's end,
 * the first line that carries a `^id`; a list item or heading starts a
 * block of its own. Without one, the paragraph's last line is where a new
 * ID goes.
 */
function locateBlock(content: string, offset: number): SourceBlock {
	const reason = structureAround(content, { from: offset, to: offset });
	if (reason && reason !== "inside inline code")
		return { _tag: "Unaddressable", reason };
	let start = lineStartOf(content, offset);
	let lastEnd = lineEndOf(content, start);
	for (let first = true; start <= content.length; first = false) {
		const line = lineAt(content, start);
		if (!first && breaksBlock(line)) break;
		const id = blockIdHelper.extractFromLine(line);
		if (id) return { _tag: "Identified", id };
		lastEnd = start + line.length;
		const end = lineEndOf(content, start);
		if (end >= content.length) break;
		start = end + 1;
	}
	return { _tag: "Unidentified", mintAt: lastEnd };
}

/** The source block of each offset in `content`. */
export function sourceBlocksOf(
	content: string,
	offsets: readonly number[],
): ReadonlyMap<number, SourceBlock> {
	return new Map(
		offsets.map((offset) => [offset, locateBlock(content, offset)]),
	);
}

/** The Attestation Ref Lemma notes store: an embed of the Scroll's block. */
export function attestationRefOf(scrollPath: string, blockId: string): string {
	const file = scrollPath.split("/").at(-1) ?? scrollPath;
	const basename = file.endsWith(".md") ? file.slice(0, -3) : file;
	return blockIdHelper.formatEmbed(basename, blockId);
}

/**
 * How snapshot offsets map onto the current content. A range outside the
 * region between their common prefix and suffix moves with it; one inside
 * it moves with its line, when that line occurs exactly once in the current
 * content, so typing elsewhere in the Scroll leaves it in place.
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
		const start = lineStartOf(snapshot, from);
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

export type MintedBlockIds = {
	readonly content: string;
	/** The ID each requested block carries now, by its snapshot `mintAt`. */
	readonly ids: ReadonlyMap<number, string>;
	/** The IDs this write appended, at their snapshot offsets, when it saw the snapshot. */
	readonly appended: readonly {
		readonly at: number;
		readonly text: string;
	}[];
};

/**
 * Gives each block without an ID one, numbered after the highest `^N` the
 * current content holds, so overlapping runs never mint the same ID. A
 * block is found again by its first line, and its ID goes at the end of the
 * paragraph as it is now; a block that gained an ID meanwhile keeps it.
 */
export function mintBlockIds(input: {
	readonly snapshot: string;
	readonly current: string;
	readonly mintAts: readonly number[];
}): MintedBlockIds {
	const { current, snapshot } = input;
	const map = offsetMapper(snapshot, current);
	let next = blockIdHelper.findHighestNumber(current) + 1;
	const ids = new Map<number, string>();
	const inserts = new Map<
		number,
		{ readonly id: string; readonly at: number }
	>();
	for (const mintAt of new Set(input.mintAts)) {
		const start = lineStartOf(snapshot, mintAt);
		const moved = map.range({ from: start, to: start });
		if (!moved) continue;
		const block = locateBlock(current, moved.from);
		if (block._tag === "Identified") {
			ids.set(mintAt, block.id);
			continue;
		}
		if (block._tag === "Unaddressable") continue;
		const planned = inserts.get(block.mintAt);
		if (planned) {
			ids.set(mintAt, planned.id);
			continue;
		}
		const id = String(next++);
		inserts.set(block.mintAt, { at: mintAt, id });
		ids.set(mintAt, id);
	}
	let content = current;
	for (const [at, { id }] of [...inserts].sort(([a], [b]) => b - a))
		content = `${content.slice(0, at)} ^${id}${content.slice(at)}`;
	const appended =
		current === snapshot
			? [...inserts.values()].map(({ at, id }) => ({
					at,
					text: ` ^${id}`,
				}))
			: [];
	return { appended, content, ids };
}

/**
 * The snapshot with `appended` inserted, and how its ranges move, so links
 * map onto content that already holds the IDs a run minted.
 */
export function withAppended(
	snapshot: string,
	appended: readonly { readonly at: number; readonly text: string }[],
): {
	readonly content: string;
	readonly move: (range: SourceRange) => SourceRange;
} {
	const sorted = [...appended].sort((a, b) => a.at - b.at);
	let content = snapshot;
	for (const { at, text } of [...sorted].reverse())
		content = content.slice(0, at) + text + content.slice(at);
	const shift = (offset: number, end: boolean) =>
		offset +
		sorted
			.filter(({ at }) => (end ? at < offset : at <= offset))
			.reduce((sum, { text }) => sum + text.length, 0);
	return {
		content,
		move: (range) => ({
			from: shift(range.from, false),
			to: shift(range.to, true),
		}),
	};
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
};

/** `[[Worter/…/See#^r-…|See]]`: the path-qualified link to a Reading block. */
export function readingLink(target: LinkTarget, shown: string): string {
	const path = target.lemmaPath.endsWith(".md")
		? target.lemmaPath.slice(0, -3)
		: target.lemmaPath;
	return `[[${path}#^${target.readingBlockId}|${shown}]]`;
}

const LINKISH =
	/!?\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]|!?\[[^\]\n]*\]\([^)\n]*\)/gu;

/**
 * What to replace for an occurrence at `range`: the range itself, or a
 * whole earlier Classify link whose shown text it is exactly, so links
 * never nest. An occurrence inside an embed, a Markdown link, a link the
 * user wrote or only part of a link's shown text is left alone.
 */
function replaceableSpan(
	content: string,
	range: SourceRange,
): SourceRange | string {
	const lineStart = lineStartOf(content, range.from);
	const line = content.slice(lineStart, lineEndOf(content, range.from));
	LINKISH.lastIndex = 0;
	for (let match = LINKISH.exec(line); match; match = LINKISH.exec(line)) {
		const from = lineStart + match.index;
		const to = from + match[0].length;
		if (to <= range.from || from >= range.to) continue;
		const [whole, target, alias] = match;
		if (whole.startsWith("!") || target === undefined)
			return "inside an embed or a Markdown link";
		if (!target.startsWith(DICTIONARY_PREFIX))
			return "inside the user's link";
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

/** Characters a link's shown text cannot hold, or that mark up the text around it. */
const UNLINKABLE = /[[\]|\n\r*_`=~]/u;

/**
 * Links every occurrence of every edit in `current`, wherever the
 * snapshot's text is still in place.
 */
export function linkUnitsInScroll(input: {
	readonly snapshot: string;
	readonly current: string;
	readonly edits: readonly UnitLinkEdit[];
}): LinkedScroll {
	const { current, snapshot } = input;
	const map = offsetMapper(snapshot, current);
	type Replacement = SourceRange & {
		readonly text: string;
		readonly edit: number;
	};
	const replacements: Replacement[] = [];
	const skipped: SkippedLink[] = [];
	const linked = input.edits.map(() => 0);
	for (const [index, edit] of input.edits.entries()) {
		for (const occurrence of edit.occurrences) {
			const text = snapshot.slice(occurrence.from, occurrence.to);
			const skip = (reason: string) =>
				skipped.push({ reason, ref: edit.ref, text });
			if (!text.trim() || UNLINKABLE.test(text)) {
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
			const structure = structureAround(current, moved);
			if (structure) {
				skip(structure);
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
	let content = current;
	for (const replacement of [...replacements].sort(
		(a, b) => b.from - a.from,
	)) {
		content =
			content.slice(0, replacement.from) +
			replacement.text +
			content.slice(replacement.to);
		linked[replacement.edit] = (linked[replacement.edit] ?? 0) + 1;
	}
	return { content, linked, skipped };
}
