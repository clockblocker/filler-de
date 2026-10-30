/**
 * Which recorded occurrences a Scroll no longer links (#116): the pure half
 * of the unlink observer. An occurrence's Attestation Link names its block
 * (`![[Story#^0|^1a2b3c4d]]`) and its Reading; its Reading's links in the
 * Scroll are the links Obsidian resolves to that Reading's note, however
 * they spell its path: `[[Worter/…]]` as Classify writes them, the
 * shortest path or another case Obsidian's link updater may rewrite them
 * to, with a heading or block, or as an embed.
 *
 * It judges an occurrence unlinked only when no link to its Reading
 * explains it, and a link explains a missing occurrence only when its key
 * is recorded, or cannot be computed. A link's key is its occurrence key
 * (`occurrenceKeyOf`), recomputed by the caller from the Sentence it
 * stands in:
 *
 * - **No link to its Reading.** When the Scroll holds none, every
 *   occurrence of that Reading recorded in it is unlinked, with no key
 *   computed.
 * - **A link in a block that records its Reading** is the occurrence of
 *   that block its key names: at its own instance of its Sentence's text,
 *   else at another, as when an earlier copy of a repeated Sentence was
 *   deleted. A key the block records at no instance is an occurrence that
 *   was never attested, such as one linked but never clicked (#281), and
 *   explains nothing.
 * - **A link in a block that records none of its Reading, or one without
 *   an ID,** is text that moved or lost its ID: it explains every
 *   occurrence its key names, at any instance. A key recorded nowhere
 *   explains nothing.
 * - **A link whose key cannot be computed**, as its Sentence was edited,
 *   its segmentation is not cached or it covers no single unit, may be any
 *   occurrence: it explains those of its Reading recorded in its block, or
 *   every one in the Scroll when it stands in a block that records none,
 *   or one without an ID.
 * - **A block that is gone.** A paragraph cut to paste elsewhere, split
 *   into a page or never synced unlinks nothing.
 * - **Links in flux.** A block holding a link Obsidian resolves to no note,
 *   such as one to a note the store just renamed while Obsidian has not
 *   rewritten the link yet, is left alone.
 *
 * Whether the file is the Scroll at all is the caller's to settle first:
 * `linksOneOf` is the evidence the file itself gives.
 */
import { scrollBodyRange } from "../../../stateless-helpers/scroll-body-range";
import type { SourceRange } from "../types";
import type { KeyedOccurrence } from "./occurrence-keys";
import {
	blockIdsOf,
	occurrenceKeyOf,
	sourceBlocksOf,
	structureAround,
} from "./scroll-links";

/** A wikilink or embed: group 1 an embed's `!`, group 2 its target, group 3 its alias. */
const WIKILINK = /(!?)\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]/gu;

/** A wikilink or embed as the Scroll writes it. */
export type WrittenLink = {
	/**
	 * The path Obsidian resolves: its target without a heading or block, the
	 * backslash that escapes a pipe in a table, or surrounding spaces. Empty
	 * for a link into the Scroll itself.
	 */
	readonly linkpath: string;
	/** Its shown text in the Scroll. */
	readonly shown: SourceRange;
	/** The ID of its block, if it has one. */
	readonly block: string | undefined;
};

/** A link in the Scroll, as Obsidian resolves it. */
export type ScrollLink = {
	/** The note Obsidian opens for it, `.md` included; none when it opens none. */
	readonly notePath: string | undefined;
	/** Its shown text in the Scroll. */
	readonly shown: SourceRange;
	/** The ID of its block, if it has one. */
	readonly block: string | undefined;
};

/** One recorded occurrence in the Scroll: its ref, as its Attestation Link holds it. */
export type RecordedOccurrence = {
	readonly ref: string;
	readonly blockId: string;
	/** Its occurrence key, the ref's alias. */
	readonly occurrence: string;
	/** Its Reading's note, `.md` included. */
	readonly readingPath: string;
};

const linkpathOf = (target: string) => {
	const hash = target.indexOf("#");
	return (hash < 0 ? target : target.slice(0, hash))
		.replace(/\\$/u, "")
		.trim();
};

/**
 * The wikilinks and embeds in the Scroll's body, with the blocks they stand
 * in. Links inside code and comments are not links.
 */
export function scrollLinksOf(content: string): WrittenLink[] {
	const body = scrollBodyRange(content);
	const text = content.slice(body.from, body.to);
	const links: { linkpath: string; shown: SourceRange }[] = [];
	WIKILINK.lastIndex = 0;
	for (let match = WIKILINK.exec(text); match; match = WIKILINK.exec(text)) {
		const [whole, embed = "", target = "", alias] = match;
		const from = body.from + match.index;
		const open = from + embed.length + 2;
		const shown =
			alias === undefined
				? { from: open, to: open + target.length }
				: {
						from: from + whole.indexOf("|") + 1,
						to: from + whole.length - 2,
					};
		const structure = structureAround(content, {
			from,
			to: from + whole.length,
		});
		if (
			structure === "inside a code block" ||
			structure === "inside inline code" ||
			structure === "inside a comment"
		)
			continue;
		links.push({ linkpath: linkpathOf(target), shown });
	}
	const blocks = sourceBlocksOf(
		content,
		links.map(({ shown }) => shown.from),
	);
	return links.map((link) => {
		const block = blocks.get(link.shown.from);
		return {
			...link,
			block: block?._tag === "Identified" ? block.id : undefined,
		};
	});
}

/**
 * Whether the Scroll still links one of its recorded occurrences in that
 * occurrence's block. Block IDs run `^0`, `^1`… in every classified file,
 * so a match of blocks alone tells another file of the same name from the
 * Scroll no better than chance.
 */
export const linksOneOf = (
	links: readonly ScrollLink[],
	recorded: readonly RecordedOccurrence[],
) =>
	links.some(
		({ block, notePath }) =>
			block !== undefined &&
			notePath !== undefined &&
			recorded.some(
				({ blockId, readingPath }) =>
					readingPath === notePath && blockId === block,
			),
	);

/** Where a link stands: its shown text's start, which no other link shares. */
export const linkKeyOf = (link: ScrollLink) => link.shown.from;

export type UnlinkedOccurrences = {
	/** The refs of the occurrences the Scroll no longer links. */
	readonly unlinked: readonly string[];
	/**
	 * Links whose occurrence keys would settle whether their Reading's
	 * occurrences are still linked, when `keys` lacks them.
	 */
	readonly unkeyed: readonly ScrollLink[];
};

/**
 * How many instances of a Sentence's text a link's unit is matched at,
 * besides its own.
 */
const MAX_INSTANCE = 256;

/**
 * Whether `key`'s unit, at its own instance of its Sentence's text or
 * another, has the occurrence key `occurrence`.
 */
const atAnyInstance = (key: KeyedOccurrence, occurrence: string) => {
	if (key.occurrence === occurrence) return true;
	for (let instance = 0; instance < MAX_INSTANCE; instance++)
		if (
			instance !== key.instance &&
			occurrenceKeyOf(key, instance) === occurrence
		)
			return true;
	return false;
};

/**
 * The refs of its Reading's recorded `occurrences` that `link`, keyed
 * `key`, explains.
 *
 * - **No key.** It may be any occurrence: those recorded in its block, or
 *   every one when its block records none, or has no ID.
 * - **Its block records the Reading.** It is the occurrence of its block
 *   its key names at its own instance, else those it names at another, as
 *   when an earlier copy of a repeated Sentence was deleted, else none.
 * - **Its block records none of the Reading, or has no ID.** Text that
 *   moved or lost its ID: every occurrence its key names at any instance.
 */
function explainedBy(
	link: ScrollLink,
	key: KeyedOccurrence | undefined,
	occurrences: readonly RecordedOccurrence[],
): readonly string[] {
	const own =
		link.block === undefined
			? []
			: occurrences.filter(({ blockId }) => blockId === link.block);
	if (key === undefined)
		return (own.length > 0 ? own : occurrences).map(({ ref }) => ref);
	if (own.length === 0)
		return occurrences
			.filter(({ occurrence }) => atAnyInstance(key, occurrence))
			.map(({ ref }) => ref);
	const exact = own.filter(({ occurrence }) => occurrence === key.occurrence);
	return (
		exact.length > 0
			? exact
			: own.filter(({ occurrence }) => atAnyInstance(key, occurrence))
	).map(({ ref }) => ref);
}

export function unlinkedOccurrences(input: {
	readonly content: string;
	readonly links: readonly ScrollLink[];
	readonly recorded: readonly RecordedOccurrence[];
	/**
	 * Each link's occurrence by `linkKeyOf`, or undefined when its key
	 * cannot be recomputed, for the links a first call answered `unkeyed`.
	 */
	readonly keys?: ReadonlyMap<number, KeyedOccurrence | undefined>;
}): UnlinkedOccurrences {
	const { keys, links, recorded } = input;
	const unlinked: string[] = [];
	const unkeyed: ScrollLink[] = [];
	const present = blockIdsOf(input.content);
	const inFlux = new Set(
		links.flatMap(({ block, notePath }) =>
			block !== undefined && notePath === undefined ? [block] : [],
		),
	);
	const byReading = new Map<string, RecordedOccurrence[]>();
	for (const occurrence of recorded)
		byReading.set(occurrence.readingPath, [
			...(byReading.get(occurrence.readingPath) ?? []),
			occurrence,
		]);
	for (const [readingPath, occurrences] of byReading) {
		const judged = occurrences.filter(
			({ blockId }) => present.has(blockId) && !inFlux.has(blockId),
		);
		if (judged.length === 0) continue;
		const linked = links.filter(({ notePath }) => notePath === readingPath);
		if (
			linked.length > 0 &&
			(!keys || linked.some((link) => !keys.has(linkKeyOf(link))))
		) {
			unkeyed.push(...linked);
			continue;
		}
		const explained = new Set(
			linked.flatMap((link) =>
				explainedBy(link, keys?.get(linkKeyOf(link)), occurrences),
			),
		);
		unlinked.push(
			...judged
				.filter(({ ref }) => !explained.has(ref))
				.map(({ ref }) => ref),
		);
	}
	return { unkeyed, unlinked };
}
