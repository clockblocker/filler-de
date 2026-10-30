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
 * `Worter/` are re-pointed, unless the run replaces the user's links too,
 * as the Dictionary reset does with links written before the redesign.
 *
 * A plain paragraph of several Sentences without an ID is first cut into
 * sentence blocks (`sentence-split.ts`), so each ID names one Sentence and
 * each Attestation embeds it. A block that already has an ID is never cut:
 * refs point at it.
 */
import {
	attestationRef,
	attestationRefPrefix,
	sha256Hex,
} from "@textfresser/lemma-note-codec";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { scrollBodyRange } from "../../../stateless-helpers/scroll-body-range";
import type { SourceRange, UnitRef } from "../types";
import {
	pieceIndexOf,
	sentenceSplitEdits,
	sentenceSplitOf,
	type TextEdit,
} from "./sentence-split";

/** The folder every link Classify writes points into (ADR 0013). */
const DICTIONARY_PREFIX = "Worter/";

const LIST_ITEM_OR_HEADING = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/u;
const FENCE = /^\s*(?:```|~~~)/u;
const TABLE_ROW = /^\s*\|/u;
/** Bare URLs and inline HTML tags, which a link inside would break. */
const INLINE_RAW = /\b[a-z][a-z0-9+.-]*:\/\/\S+|<[^>\n]+>/giu;

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
export function structureAround(
	content: string,
	range: SourceRange,
): string | undefined {
	const start = lineStartOf(content, range.from);
	const line = lineAt(content, start);
	if (inFence(content, range.from)) return "inside a code block";
	if (TABLE_ROW.test(line)) return "inside a table";
	const before = content.slice(start, range.from);
	if ((before.match(/`/gu) ?? []).length % 2 === 1)
		return "inside inline code";
	if ((before.match(/\$/gu) ?? []).length % 2 === 1)
		return "inside inline math";
	if ((before.match(/%%/gu) ?? []).length % 2 === 1)
		return "inside a comment";
	for (const match of line.matchAll(INLINE_RAW)) {
		const from = start + (match.index ?? 0);
		if (from < range.to && from + match[0].length > range.from)
			return "inside a URL or HTML";
	}
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

/** A block ID at a line's end, after whitespace, as Obsidian reads one. */
const BLOCK_ID = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/u;
const blockIdOf = (line: string) => BLOCK_ID.exec(line)?.[1] ?? null;
const HEADING = /^\s{0,3}#{1,6}\s/u;
const QUOTE = /^\s*>\s?/u;

/**
 * The block `offset` belongs to: from its line on to the paragraph's end,
 * the first line that carries a `^id`; a list item or heading starts a
 * block of its own. Without one, the paragraph's last line is where a new
 * ID goes.
 */
function locateBlock(content: string, offset: number): SourceBlock {
	const reason = structureAround(content, { from: offset, to: offset });
	if (reason && !reason.startsWith("inside inline"))
		return { _tag: "Unaddressable", reason };
	let start = lineStartOf(content, offset);
	const opening = lineAt(content, start);
	const quote = QUOTE.test(opening);
	// A heading is a block of its own line; a quote runs on while its lines do.
	const continues = (line: string) =>
		HEADING.test(opening)
			? false
			: quote
				? QUOTE.test(line) && line.replace(QUOTE, "").trim() !== ""
				: !breaksBlock(line);
	let lastEnd = lineEndOf(content, start);
	for (let first = true; start <= content.length; first = false) {
		const line = lineAt(content, start);
		if (!first && !continues(line)) break;
		const id = blockIdOf(line);
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

const FOOTNOTE_DEFINITION = /^\s*\[\^[^\]]+\]:/u;
const INDENTED_CODE = /^(?: {4}|\t)/u;
/** Markup a cut could break that the cut checks do not see: math, comments, HTML. */
const OPAQUE = /\$\$|%%|<!--|<\/?[A-Za-z][^>\n]*>/u;

/**
 * The plain paragraph `offset` lies in, from its first line to where its
 * ID would go, when it has no ID and a cut into sentence blocks keeps its
 * Markdown: no heading, list item, quote, footnote definition, code, table,
 * math, comment or HTML, and no line before it that it would run on from.
 */
function plainParagraphAt(
	content: string,
	offset: number,
): SourceRange | undefined {
	const block = locateBlock(content, offset);
	if (block._tag !== "Unidentified") return undefined;
	const bodyFrom = scrollBodyRange(content).from;
	let from = lineStartOf(content, offset);
	while (from > bodyFrom) {
		const previousStart = lineStartOf(content, from - 1);
		const previous = lineAt(content, previousStart);
		if (previous.trim() === "" || HEADING.test(previous)) break;
		// A list item or quote it continues, or a block whose ID ends it.
		if (
			breaksBlock(previous) ||
			QUOTE.test(previous) ||
			blockIdOf(previous)
		)
			return undefined;
		from = previousStart;
	}
	if (from < bodyFrom) return undefined;
	const first = lineAt(content, from);
	if (
		breaksBlock(first) ||
		QUOTE.test(first) ||
		FOOTNOTE_DEFINITION.test(first) ||
		INDENTED_CODE.test(first) ||
		OPAQUE.test(content.slice(from, block.mintAt))
	)
		return undefined;
	return { from, to: block.mintAt };
}

/** An `_` that may open or close emphasis: not inside a word. */
const UNDERSCORE_EMPHASIS = /(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu;

/**
 * Whether a cut at `at`, in `paragraph`, leaves the Markdown around it
 * whole: never inside code, math, a comment, a URL or HTML, a link or an
 * embed, nor inside `_` emphasis, which the formatter does not close and
 * open again as it does `*`, `~~` and `==`.
 */
function cutAllowed(
	content: string,
	paragraph: SourceRange,
	at: number,
): boolean {
	if (structureAround(content, { from: at, to: at })) return false;
	if (
		linksAround(content, { from: at, to: at }).some(
			(link) => link.from < at && at < link.to,
		)
	)
		return false;
	const before = content
		.slice(paragraph.from, at)
		.replace(LINKISH, "")
		.replace(INLINE_RAW, "");
	return (before.match(UNDERSCORE_EMPHASIS) ?? []).length % 2 === 0;
}

/** The block IDs that end the lines of `content`. */
export function blockIdsOf(content: string): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const line of content.split("\n")) {
		const id = blockIdOf(line.replace(/\r$/u, ""));
		if (id) ids.add(id);
	}
	return ids;
}

/** A Scroll's name as its embeds spell it: its basename. */
export function scrollBasenameOf(scrollPath: string): string {
	const file = scrollPath.split("/").at(-1) ?? scrollPath;
	return file.endsWith(".md") ? file.slice(0, -3) : file;
}

/**
 * The key of one occurrence in its Scroll: its Sentence, its Segments and
 * which instance of the Sentence's text it stands in, so running Classify
 * over the same occurrence again names the same ref, while the instances
 * of a repeated Sentence never share one. The first instance's key leaves
 * the instance out.
 */
export function occurrenceKeyOf(ref: UnitRef, instance: number): string {
	return sha256Hex(
		JSON.stringify(
			instance === 0
				? [ref.sentenceKey, ref.segments]
				: [ref.sentenceKey, ref.segments, instance],
		),
	).slice(0, 8);
}

/**
 * The Attestation Ref a Reading note stores for one occurrence: an embed of
 * the Scroll's block, `![[Story#^0|^1a2b3c4d]]`. A ref names one occurrence
 * and is unique in the dictionary (texteater#1227), while one block holds
 * many, so the alias carries the occurrence's key. Obsidian never shows an
 * embed's alias: Reading view replaces the embed's text with the embedded
 * block, and Live Preview keeps the alias only as the embed's `alt`
 * attribute (Obsidian 1.14.4's `app.js`), so it shows only in source.
 * `linkpath` names the Scroll: Classify asks the dictionary store for it
 * (`scrollRefNames`), which answers the basename when Obsidian opens the
 * Scroll for it from the Reading note the ref goes in, and the path
 * otherwise, as its rename rewrite names it (#99, #198, #210). Without
 * one, the ref names the Scroll by its basename.
 */
export function attestationRefOf(
	scrollPath: string,
	blockId: string,
	occurrence: string,
	linkpath: string = scrollBasenameOf(scrollPath),
): string {
	return attestationRef({ blockId, linkpath, occurrence });
}

/** What every Attestation Ref into one Scroll by its basename starts with: `![[Story#^`. */
export function attestationRefPrefixOf(scrollPath: string): string {
	return attestationRefPrefix(scrollBasenameOf(scrollPath));
}

/** The Scroll's path as a ref names it where its basename is not its own: `Library/Story`. */
export function scrollLinkpathOf(scrollPath: string): string {
	return scrollPath.endsWith(".md") ? scrollPath.slice(0, -3) : scrollPath;
}

export { parseAttestationRef } from "@textfresser/lemma-note-codec";

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

/** An edit to the Scroll, at offsets in the content it applies to. */
export type ScrollEdit = TextEdit;

export type MintedBlockIds = {
	readonly content: string;
	/** The ID of the block each requested snapshot offset lies in now. */
	readonly ids: ReadonlyMap<number, string>;
	/**
	 * What this write changed where the snapshot's text still stood, at
	 * snapshot offsets: IDs appended at a line's end, and paragraphs cut
	 * into sentence blocks.
	 */
	readonly edits: readonly ScrollEdit[];
};

/** A paragraph this write cuts into sentence blocks. */
type PlannedSplit = {
	/** Where the paragraph stands in the current content. */
	readonly current: SourceRange;
	/** Where it stands in the snapshot. */
	readonly snapshotFrom: number;
	/** The cut, at offsets in the paragraph. */
	readonly edits: readonly TextEdit[];
};

/**
 * Gives each block without an ID one, numbered after the highest `^N` the
 * current content holds, so overlapping runs never mint the same ID.
 * `offsets` are snapshot offsets, one per occurrence that needs an ID.
 *
 * A plain paragraph of several Sentences is first cut into sentence
 * blocks, each with its own ID, so an occurrence gets the ID of its
 * Sentence. The cut lands only when the paragraph is still, character for
 * character, what the snapshot held, found by its first line. Otherwise,
 * and for any other block, the block is found again by its first line, and
 * one ID goes at the end of the paragraph as it is now; a block that gained
 * an ID meanwhile keeps it.
 */
export function mintBlockIds(input: {
	readonly snapshot: string;
	readonly current: string;
	readonly offsets: readonly number[];
}): MintedBlockIds {
	const { current, snapshot } = input;
	const map = offsetMapper(snapshot, current);
	let next = blockIdHelper.findHighestNumber(current) + 1;
	const ids = new Map<number, string>();
	const inserts = new Map<number, { readonly id: string }>();
	/** Where each mint's snapshot line end sits in the current content, if its line is intact. */
	const appendedAt = new Map<number, number>();
	const splits: PlannedSplit[] = [];
	const inSplit = (at: number) =>
		splits.some(({ current }) => current.from <= at && at <= current.to);

	// The offsets of each snapshot block, in the order they first appear.
	const groups = new Map<number, number[]>();
	for (const offset of new Set(input.offsets)) {
		const block = locateBlock(snapshot, offset);
		if (block._tag !== "Unidentified") continue;
		const group = groups.get(block.mintAt);
		if (group) group.push(offset);
		else groups.set(block.mintAt, [offset]);
	}

	/** Cuts the group's paragraph into sentence blocks, if it may. */
	const split = (offsets: readonly number[]): boolean => {
		const [first] = offsets;
		if (first === undefined) return false;
		const paragraph = plainParagraphAt(snapshot, first);
		if (!paragraph) return false;
		const text = snapshot.slice(paragraph.from, paragraph.to);
		const pieces = sentenceSplitOf(text, (at) =>
			cutAllowed(snapshot, paragraph, paragraph.from + at),
		);
		if (!pieces) return false;
		const moved = map.range({
			from: paragraph.from,
			to: paragraph.from + lineAt(snapshot, paragraph.from).length,
		});
		if (!moved) return false;
		const here = plainParagraphAt(current, moved.from);
		if (
			!here ||
			here.from !== moved.from ||
			current.slice(here.from, here.to) !== text ||
			[...inserts.keys()].some((at) => here.from <= at && at <= here.to)
		)
			return false;
		const pieceIds = pieces.map(() => String(next++));
		splits.push({
			current: here,
			edits: sentenceSplitEdits(pieces, pieceIds, text.length),
			snapshotFrom: paragraph.from,
		});
		for (const offset of offsets) {
			const id = pieceIds[pieceIndexOf(pieces, offset - paragraph.from)];
			if (id !== undefined) ids.set(offset, id);
		}
		return true;
	};

	for (const [mintAt, offsets] of groups) {
		if (split(offsets)) continue;
		const start = lineStartOf(snapshot, mintAt);
		// The whole line, so the block is found by its text, never by an
		// offset the user's typing now gives another line.
		const moved = map.range({ from: start, to: mintAt });
		if (
			!moved ||
			current.slice(moved.from, moved.to) !==
				snapshot.slice(start, mintAt) ||
			lineStartOf(current, moved.from) !== moved.from
		)
			continue;
		const block = locateBlock(current, moved.from);
		if (block._tag === "Unidentified" && block.mintAt === moved.to)
			appendedAt.set(block.mintAt, mintAt);
		if (block._tag === "Identified") {
			for (const offset of offsets) ids.set(offset, block.id);
			continue;
		}
		if (block._tag === "Unaddressable" || inSplit(block.mintAt)) continue;
		let planned = inserts.get(block.mintAt);
		if (!planned) {
			planned = { id: String(next++) };
			inserts.set(block.mintAt, planned);
		}
		for (const offset of offsets) ids.set(offset, planned.id);
	}

	const shifted = (edits: readonly TextEdit[], by: number) =>
		edits.map((edit) => ({
			from: edit.from + by,
			text: edit.text,
			to: edit.to + by,
		}));
	const writes: TextEdit[] = [
		...[...inserts].map(([at, { id }]) => ({
			from: at,
			text: ` ^${id}`,
			to: at,
		})),
		...splits.flatMap(({ current, edits }) => shifted(edits, current.from)),
	];
	let content = current;
	for (const edit of writes.sort((a, b) => b.from - a.from))
		content =
			content.slice(0, edit.from) + edit.text + content.slice(edit.to);
	// An ID appended where the snapshot's line ended, and a paragraph cut as
	// the snapshot held it, also go into the snapshot, so links later diff
	// only against the user's own edits.
	const edits = [
		...[...inserts].flatMap(([currentAt, { id }]) => {
			const at = appendedAt.get(currentAt);
			return at === undefined
				? []
				: [{ from: at, text: ` ^${id}`, to: at }];
		}),
		...splits.flatMap(({ edits, snapshotFrom }) =>
			shifted(edits, snapshotFrom),
		),
	];
	return { content, edits, ids };
}

/**
 * The snapshot with `edits` applied, and how its ranges move, so links
 * map onto content that already holds the IDs and cuts a run made. A range
 * that starts where an ID is appended moves past it; one that ends there
 * does not.
 */
export function withEdits(
	snapshot: string,
	edits: readonly ScrollEdit[],
): {
	readonly content: string;
	readonly move: (range: SourceRange) => SourceRange;
} {
	const sorted = [...edits].sort((a, b) => a.from - b.from);
	let content = snapshot;
	for (const edit of [...sorted].reverse())
		content =
			content.slice(0, edit.from) + edit.text + content.slice(edit.to);
	const shift = (offset: number, end: boolean) =>
		offset +
		sorted
			.filter(({ from, to }) =>
				end ? from < offset && to <= offset : to <= offset,
			)
			.reduce(
				(sum, { from, text, to }) => sum + text.length - (to - from),
				0,
			);
	return {
		content,
		move: (range) => ({
			from: shift(range.from, false),
			to: shift(range.to, true),
		}),
	};
}

/** The Reading note a unit links to. */
type LinkTarget = {
	/** The Reading note's vault path, `.md` included. */
	readonly readingPath: string;
};

/** One unit's links: every piece of it, located in the snapshot. */
export type UnitLinkEdit = {
	readonly ref: UnitRef;
	readonly target: LinkTarget;
	readonly occurrences: readonly SourceRange[];
};

type SkippedLink = {
	readonly ref: UnitRef;
	/** The occurrence's text as a reader sees it. */
	readonly text: string;
	readonly reason: string;
};

export type LinkedScroll = {
	readonly content: string;
	/** Per edit, in order: how many of its occurrences were linked. */
	readonly linked: readonly number[];
	readonly skipped: readonly SkippedLink[];
};

/**
 * `[[Worter/…/🌊 See|See]]`: the path-qualified link to a Reading note
 * (ADR-0015). The links it replaces at the occurrence go whole
 * (`replaceableSpan`).
 */
function readingLink(target: LinkTarget, shown: string): string {
	const path = target.readingPath.endsWith(".md")
		? target.readingPath.slice(0, -3)
		: target.readingPath;
	return `[[${path}|${shown}]]`;
}

/** A wikilink, embed or Markdown link on a line, with the part a reader sees. */
type LinkSpan = SourceRange & {
	readonly kind: "Wikilink" | "Embed" | "Markdown";
	/** A wikilink's target, `#` part included. */
	readonly target: string;
	/** What Obsidian shows of it; none for an embed. */
	readonly shown: SourceRange | undefined;
};

const LINKISH =
	/(!?)\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]|(!?)\[([^\]\n]*)\]\([^)\n]*\)/gu;

/** The links on the lines `range` touches. */
function linksAround(content: string, range: SourceRange): LinkSpan[] {
	const start = lineStartOf(content, range.from);
	const text = content.slice(start, lineEndOf(content, range.to));
	return [...text.matchAll(LINKISH)].map((match): LinkSpan => {
		const [whole, wikiBang, target, alias, markdownBang, label] = match;
		const from = start + (match.index ?? 0);
		const to = from + whole.length;
		if (target === undefined)
			return {
				from,
				kind: "Markdown",
				shown: markdownBang
					? undefined
					: { from: from + 1, to: from + 1 + (label ?? "").length },
				target: "",
				to,
			};
		if (wikiBang)
			return { from, kind: "Embed", shown: undefined, target, to };
		if (alias !== undefined)
			return {
				from,
				kind: "Wikilink",
				shown: { from: from + whole.indexOf("|") + 1, to: to - 2 },
				target,
				to,
			};
		const hash = target.indexOf("#");
		return {
			from,
			kind: "Wikilink",
			shown: {
				from: from + 2,
				to: from + 2 + (hash < 0 ? target.length : hash),
			},
			target,
			to,
		};
	});
}

/**
 * The text a reader sees of `range`: the shown text of each link in it,
 * without the link's markup. An occurrence of several Segments with a link
 * between them, `Der [[Fahrer]]`, reads `Der Fahrer`.
 */
function visibleText(content: string, range: SourceRange): string {
	const links = linksAround(content, range);
	let text = "";
	for (let at = range.from; at < range.to; at++) {
		const link = links.find(({ from, to }) => from <= at && at < to);
		if (
			link &&
			!(link.shown && link.shown.from <= at && at < link.shown.to)
		)
			continue;
		text += content[at] ?? "";
	}
	return text;
}

/**
 * What the links Classify finds at an occurrence are to it: links the user
 * wrote are kept, or replaced, as the Dictionary reset replaces the old
 * notes' links (#148).
 */
export type UserLinks = "Keep" | "Replace";

/**
 * What to replace for an occurrence at `range`: the range itself, or the
 * range with the links whose shown text lies in it, so links never nest.
 * An earlier Classify link, such as a pre-ADR-0015 `[[…/See#^r-…|See]]`,
 * is always replaced whole; under `Replace`, so is a link the user wrote,
 * such as the old `[[Fahrer]]` of `Der [[Fahrer]]`. An occurrence inside
 * an embed, a Markdown link, a link the user wrote that is kept, or a link
 * that shows more than it is left alone.
 */
function replaceableSpan(
	content: string,
	range: SourceRange,
	userLinks: UserLinks,
): SourceRange | string {
	let span = range;
	for (const link of linksAround(content, range)) {
		if (link.to <= range.from || link.from >= range.to) continue;
		const { shown } = link;
		if (link.kind !== "Wikilink" || shown === undefined)
			return "inside an embed or a Markdown link";
		const own = link.target.startsWith(DICTIONARY_PREFIX);
		if (!own && userLinks === "Keep") return "inside the user's link";
		if (shown.from < range.from || shown.to > range.to)
			return own
				? "inside another link"
				: "the user's link shows more than it";
		span = {
			from: Math.min(span.from, link.from),
			to: Math.max(span.to, link.to),
		};
	}
	return span;
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
	/** Whether the user's links at an occurrence are kept; `Keep` when absent. */
	readonly userLinks?: UserLinks;
}): LinkedScroll {
	const { current, snapshot } = input;
	const userLinks = input.userLinks ?? "Keep";
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
			// What the reader sees of it: what notices quote and the link
			// shows. An embed shows none of it, and says why below.
			const shown = visibleText(snapshot, occurrence);
			const skip = (reason: string) =>
				skipped.push({
					reason,
					ref: edit.ref,
					text: shown.trim() ? shown : text,
				});
			if (!text.trim() || UNLINKABLE.test(shown)) {
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
			const span = replaceableSpan(current, moved, userLinks);
			if (typeof span === "string") {
				skip(span);
				continue;
			}
			if (!shown.trim()) {
				skip("its text cannot be a link's shown text");
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
				text: readingLink(edit.target, shown),
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
