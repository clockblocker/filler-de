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
import { type ScrollSentence, scrollSentences } from "../scroll-sentences";
import type { SourceRange, UnitRef } from "../types";
import {
	findNewCut,
	pieceIndexOf,
	type SentenceSplit,
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

/**
 * Whether a cut over `gap`, in the paragraph, leaves the Markdown around
 * it whole: never inside code, math, a comment, a URL or HTML, a link or
 * an embed. Emphasis the formatter closes and opens again around the cut.
 */
function cutAllowed(content: string, gap: SourceRange): boolean {
	const at = gap.from;
	if (structureAround(content, { from: at, to: at })) return false;
	return !linksAround(content, { from: at, to: at }).some(
		(link) => link.from < at && at < link.to,
	);
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
 * the instance out. The Sentence is named by its key under the frozen
 * `OCCURRENCE_KEY_VERSION`, so a battery bump changes no key.
 */
export function occurrenceKeyOf(
	ref: Pick<UnitRef, "occurrenceSentenceKey" | "segments">,
	instance: number,
): string {
	return sha256Hex(
		JSON.stringify(
			instance === 0
				? [ref.occurrenceSentenceKey, ref.segments]
				: [ref.occurrenceSentenceKey, ref.segments, instance],
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
	 * The edits that bring the snapshot in line with what this write left,
	 * at snapshot offsets, where the snapshot's text still stood: IDs
	 * appended at a line's end, paragraphs cut into sentence blocks, by
	 * this write or by another run that read the same paragraph.
	 */
	readonly edits: readonly ScrollEdit[];
	/** Snapshot Sentences found again by their text, which `edits` do not map. */
	readonly relocations: readonly Relocation[];
};

/**
 * A snapshot Sentence that stands, character for character, at `at` in
 * the content the write left, where the snapshot's offsets no longer lead.
 */
type Relocation = {
	readonly sentence: SourceRange;
	readonly at: number;
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

/** A plain paragraph of the snapshot and the sentence blocks it cuts into. */
type CutPlan = {
	readonly paragraph: SourceRange;
	readonly text: string;
	readonly split: SentenceSplit;
};

/** The line ending `content` uses. */
const eolOf = (content: string) => (content.includes("\r\n") ? "\r\n" : "\n");

/** How the plain paragraph at `offset` cuts into sentence blocks, if it holds several Sentences. */
function cutPlanAt(content: string, offset: number): CutPlan | undefined {
	const paragraph = plainParagraphAt(content, offset);
	if (!paragraph) return undefined;
	const text = content.slice(paragraph.from, paragraph.to);
	const split = sentenceSplitOf(text, (gap) =>
		cutAllowed(content, {
			from: paragraph.from + gap.from,
			to: paragraph.from + gap.to,
		}),
	);
	return split && { paragraph, split, text };
}

/**
 * Gives each block without an ID one, numbered after the highest `^N` the
 * current content holds, so overlapping runs never mint the same ID.
 * `offsets` are snapshot offsets, one per occurrence that needs an ID. It
 * is a pure function of the two contents and the offsets, so any caller
 * holding a snapshot can run it in a compare-and-swap write.
 *
 * A plain paragraph of several Sentences is cut into sentence blocks, each
 * with its own ID, so an occurrence gets the ID of its Sentence. For each
 * paragraph, in this order:
 *
 * 1. The paragraph is still, character for character, what the snapshot
 *    held, found by its first line: it is cut here.
 * 2. Another run that read the same paragraph cut it already: its blocks'
 *    IDs are taken, and its cut goes into the snapshot as if this write
 *    made it, so the links still map.
 * 3. The block is found again by its last line, and one ID goes at the end
 *    of the paragraph as it is now; a block that gained an ID meanwhile
 *    keeps it.
 * 4. Each occurrence's Sentence is found in the current content by its
 *    text, as Classify reads it, where exactly one Sentence has that text,
 *    the snapshot held it once, and its Markdown is still the snapshot's,
 *    character for character. It
 *    takes its block's ID, or gives the block one, and is answered as a
 *    `Relocation`, so the occurrence still links. An occurrence found no
 *    other way gets no ID: its unit stays unattested rather than gain a
 *    ref its Scroll does not link.
 */
export function mintBlockIds(input: {
	readonly snapshot: string;
	readonly current: string;
	readonly offsets: readonly number[];
}): MintedBlockIds {
	const { current, snapshot } = input;
	const map = offsetMapper(snapshot, current);
	const eol = eolOf(current);
	let next = blockIdHelper.findHighestNumber(current) + 1;
	const ids = new Map<number, string>();
	const inserts = new Map<number, { readonly id: string }>();
	/** Where each mint's snapshot line end sits in the current content, if its line is intact. */
	const appendedAt = new Map<number, number>();
	const splits: PlannedSplit[] = [];
	/** Cuts another run made, at snapshot offsets. */
	const found: TextEdit[] = [];
	const inSplit = (at: number) =>
		splits.some(({ current }) => current.from <= at && at <= current.to);
	let snapshotSentences: readonly ScrollSentence[] | undefined;
	let currentSentences: readonly ScrollSentence[] | undefined;
	/** Snapshot Sentences found in the current content, at current offsets. */
	const relocated: { sentence: SourceRange; current: SourceRange }[] = [];

	// The offsets of each snapshot block, in the order they first appear.
	const groups = new Map<number, number[]>();
	for (const offset of new Set(input.offsets)) {
		const block = locateBlock(snapshot, offset);
		if (block._tag !== "Unidentified") continue;
		const group = groups.get(block.mintAt);
		if (group) group.push(offset);
		else groups.set(block.mintAt, [offset]);
	}

	const idsOfPieces = (
		plan: CutPlan,
		offsets: readonly number[],
		pieceIds: readonly string[],
	) => {
		for (const offset of offsets) {
			const id =
				pieceIds[
					pieceIndexOf(plan.split, offset - plan.paragraph.from)
				];
			if (id !== undefined) ids.set(offset, id);
		}
	};

	/** 1: cuts the paragraph here, if it is as the snapshot held it. */
	const cutHere = (plan: CutPlan, offsets: readonly number[]): boolean => {
		const { paragraph, split, text } = plan;
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
		const pieceIds = split.map(() => String(next++));
		splits.push({
			current: here,
			edits: sentenceSplitEdits(split, pieceIds, text.length, eol),
			snapshotFrom: paragraph.from,
		});
		idsOfPieces(plan, offsets, pieceIds);
		return true;
	};

	/** 2: takes the cut another run made of the same paragraph. */
	const reuseCut = (plan: CutPlan, offsets: readonly number[]): boolean => {
		const { paragraph, split, text } = plan;
		const cut = findNewCut({ current, eol, snapshot, split, text });
		if (!cut) return false;
		for (const edit of sentenceSplitEdits(split, cut.ids, text.length, eol))
			found.push({
				from: paragraph.from + edit.from,
				text: edit.text,
				to: paragraph.from + edit.to,
			});
		idsOfPieces(plan, offsets, cut.ids);
		return true;
	};

	/** 3: one ID at the end of the block, found by its last line. */
	const appendOne = (mintAt: number, offsets: readonly number[]): boolean => {
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
			return false;
		const block = locateBlock(current, moved.from);
		if (block._tag === "Identified") {
			for (const offset of offsets) ids.set(offset, block.id);
			return true;
		}
		if (block._tag === "Unaddressable" || inSplit(block.mintAt))
			return false;
		if (block.mintAt === moved.to) appendedAt.set(block.mintAt, mintAt);
		const id = idAt(block.mintAt);
		for (const offset of offsets) ids.set(offset, id);
		return true;
	};

	/** The ID appended at `mintAt` in the current content, planned once. */
	const idAt = (mintAt: number): string => {
		let planned = inserts.get(mintAt);
		if (!planned) {
			planned = { id: String(next++) };
			inserts.set(mintAt, planned);
		}
		return planned.id;
	};

	/** 4: each occurrence's Sentence, found by its text. */
	const bySentence = (offsets: readonly number[]) => {
		snapshotSentences ??= scrollSentences(snapshot).sentences;
		currentSentences ??= scrollSentences(current).sentences;
		const now = currentSentences;
		for (const offset of offsets) {
			const sentence = snapshotSentences.find(
				({ source }) => source.from <= offset && offset < source.to,
			);
			if (!sentence) continue;
			const matches = now.filter(({ text }) => text === sentence.text);
			const [match] = matches;
			// A text the snapshot held twice, as a refrain does, could be found
			// at the other copy.
			const held = snapshotSentences.filter(
				({ text }) => text === sentence.text,
			);
			if (
				!match ||
				matches.length > 1 ||
				held.length > 1 ||
				current.slice(match.source.from, match.source.to) !==
					snapshot.slice(sentence.source.from, sentence.source.to)
			)
				continue;
			const block = locateBlock(current, match.source.from);
			let id: string | undefined;
			if (block._tag === "Identified") id = block.id;
			else if (block._tag === "Unidentified" && !inSplit(block.mintAt))
				id = idAt(block.mintAt);
			if (id === undefined) continue;
			ids.set(offset, id);
			if (
				!relocated.some(
					({ sentence: { from } }) => from === sentence.source.from,
				)
			)
				relocated.push({
					current: match.source,
					sentence: sentence.source,
				});
		}
	};

	for (const [mintAt, offsets] of groups) {
		const plan = cutPlanAt(snapshot, offsets[0] ?? mintAt);
		if (plan && (cutHere(plan, offsets) || reuseCut(plan, offsets)))
			continue;
		if (appendOne(mintAt, offsets)) continue;
		bySentence(offsets);
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
		...found,
	];
	const written = withEdits(current, writes);
	const relocations = relocated.map(({ current, sentence }) => ({
		at: written.move(current).from,
		sentence,
	}));
	return { content, edits, ids, relocations };
}

/**
 * Links every occurrence of every edit, its occurrences at snapshot
 * offsets, into `current` after `minted` landed: through the snapshot as
 * the mint's edits leave it, or, for an occurrence whose Sentence the mint
 * found again by its text, through the content the mint left.
 */
export function linkMinted(input: {
	readonly snapshot: string;
	readonly minted: MintedBlockIds;
	readonly current: string;
	readonly edits: readonly UnitLinkEdit[];
	readonly userLinks?: UserLinks;
}): LinkedScroll {
	const { minted } = input;
	const moved = withEdits(input.snapshot, minted.edits);
	const relocationOf = (edit: UnitLinkEdit) =>
		minted.relocations.find(({ sentence }) =>
			edit.occurrences.every(
				({ from, to }) => sentence.from <= from && to <= sentence.to,
			),
		);
	const mapped: UnitLinkEdit[] = [];
	const found: UnitLinkEdit[] = [];
	const order = input.edits.map((edit) => {
		const relocation = relocationOf(edit);
		if (!relocation) {
			mapped.push({
				...edit,
				occurrences: edit.occurrences.map(moved.move),
			});
			return { found: false, index: mapped.length - 1 };
		}
		const shift = relocation.at - relocation.sentence.from;
		found.push({
			...edit,
			occurrences: edit.occurrences.map(({ from, to }) => ({
				from: from + shift,
				to: to + shift,
			})),
		});
		return { found: true, index: found.length - 1 };
	});
	const userLinks =
		input.userLinks === undefined ? {} : { userLinks: input.userLinks };
	const first = linkUnitsInScroll({
		current: input.current,
		edits: mapped,
		snapshot: moved.content,
		...userLinks,
	});
	const second =
		found.length === 0
			? { content: first.content, linked: [], skipped: [] }
			: linkUnitsInScroll({
					current: first.content,
					edits: found,
					snapshot: minted.content,
					...userLinks,
				});
	return {
		content: second.content,
		linked: order.map(
			({ found, index }) =>
				(found ? second.linked : first.linked)[index] ?? 0,
		),
		skipped: [...first.skipped, ...second.skipped],
	};
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
