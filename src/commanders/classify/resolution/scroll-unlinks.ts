/**
 * Which recorded occurrences a Scroll no longer links (#116): the pure half
 * of the unlink observer. An occurrence's Attestation Link names its block
 * (`![[Story#^0|^1a2b3c4d]]`) and its Reading; its links in the Scroll are
 * the links in that block that Obsidian resolves to that Reading's note,
 * however they spell its path: `[[Worter/…]]` as Classify writes them, the
 * shortest path or another case Obsidian's link updater may rewrite them
 * to, with a heading or block, or as an embed.
 *
 * It judges an occurrence unlinked only when nothing else explains the
 * Scroll it reads, and otherwise leaves the occurrence alone:
 *
 * - **Its block holds no link to its Reading.** Every occurrence of that
 *   Reading recorded in that block is unlinked.
 * - **The block still links the Reading, and records several occurrences of
 *   it.** Which ones are gone comes from each remaining link's occurrence
 *   key (`occurrenceKeyOf`), recomputed by the caller. Only when every
 *   remaining link has a key and every key is one the block records are
 *   the other occurrences unlinked.
 * - **A block that is gone.** A paragraph cut to paste elsewhere, split
 *   into a page or never synced unlinks nothing.
 * - **Moved text.** A link to the Reading in a block that records none of
 *   its occurrences, or in a block without an ID, means the text moved or
 *   lost its ID: none of that Reading's occurrences in the Scroll is
 *   unlinked.
 * - **Links in flux.** A block holding a link Obsidian resolves to no note,
 *   such as one to a note the store just renamed while Obsidian has not
 *   rewritten the link yet, is left alone.
 *
 * Whether the file is the Scroll at all is the caller's to settle first:
 * `linksOneOf` is the evidence the file itself gives.
 */
import { scrollBodyRange } from "../../../stateless-helpers/scroll-body-range";
import type { SourceRange } from "../types";
import { blockIdsOf, sourceBlocksOf, structureAround } from "./scroll-links";

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
	 * Links whose occurrence keys would settle a block that records several
	 * occurrences of their Reading, when `keys` lacks them.
	 */
	readonly unkeyed: readonly ScrollLink[];
};

export function unlinkedOccurrences(input: {
	readonly content: string;
	readonly links: readonly ScrollLink[];
	readonly recorded: readonly RecordedOccurrence[];
	/**
	 * Each link's occurrence key by `linkKeyOf`, or undefined when it cannot
	 * be recomputed, for the links a first call answered `unkeyed`.
	 */
	readonly keys?: ReadonlyMap<number, string | undefined>;
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
		const linked = links.filter(({ notePath }) => notePath === readingPath);
		const blocks = new Set(occurrences.map(({ blockId }) => blockId));
		if (
			linked.some(
				({ block }) => block === undefined || !blocks.has(block),
			)
		)
			continue;
		for (const block of blocks) {
			if (!present.has(block) || inFlux.has(block)) continue;
			const here = occurrences.filter(({ blockId }) => blockId === block);
			const linkedHere = linked.filter((link) => link.block === block);
			if (linkedHere.length === 0) {
				unlinked.push(...here.map(({ ref }) => ref));
				continue;
			}
			if (here.length === 1) continue;
			if (
				!keys ||
				linkedHere.some((link) => !keys.has(linkKeyOf(link)))
			) {
				unkeyed.push(...linkedHere);
				continue;
			}
			const kept = new Set<string>();
			for (const link of linkedHere) {
				const key = keys.get(linkKeyOf(link));
				if (key !== undefined) kept.add(key);
			}
			const recordedKeys = new Set(
				here.map(({ occurrence }) => occurrence),
			);
			if (
				linkedHere.some(
					(link) => keys.get(linkKeyOf(link)) === undefined,
				) ||
				[...kept].some((key) => !recordedKeys.has(key))
			)
				continue;
			unlinked.push(
				...here
					.filter(({ occurrence }) => !kept.has(occurrence))
					.map(({ ref }) => ref),
			);
		}
	}
	return { unkeyed, unlinked };
}
