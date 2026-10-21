/**
 * Which recorded occurrences a Scroll no longer links (#116): the pure half
 * of the unlink observer. An occurrence's Attestation Link names its block
 * (`![[Story#^0|^1a2b3c4d]]`) and its Reading; its links in the Scroll are
 * the `[[Worter/…]]` links to that Reading's note in that block.
 *
 * It judges an occurrence unlinked only when nothing else explains the
 * Scroll it reads, and otherwise leaves the occurrence alone:
 *
 * - **Its block holds no link to its Reading.** Every occurrence of that
 *   Reading recorded in that block is unlinked, also when the block itself
 *   is gone.
 * - **The block still links the Reading, and records several occurrences of
 *   it.** Which ones are gone comes from each remaining link's occurrence
 *   key (`occurrenceKeyOf`), recomputed by the caller. Only when every
 *   remaining link has a key and every key is one the block records are
 *   the other occurrences unlinked.
 * - **Moved text.** A link to the Reading in a block that records none of
 *   its occurrences, or in a block without an ID, means the text moved or
 *   lost its ID: none of that Reading's occurrences in the Scroll is
 *   unlinked.
 * - **Links in flux.** A block holding a link to a Lemma or Reading note
 *   that is not there, such as one the store just renamed while Obsidian
 *   has not rewritten the link yet, is left alone.
 * - **Another file.** A Scroll that holds none of the blocks its refs name
 *   is no source of theirs, or was replaced wholesale: nothing is unlinked.
 */
import { scrollBodyRange } from "../../../stateless-helpers/scroll-body-range";
import type { SourceRange } from "../types";
import { blockIdsOf, sourceBlocksOf, structureAround } from "./scroll-links";

/** A wikilink into `Worter/`, not an embed; group 1 its target, group 2 its alias. */
const DICTIONARY_LINK = /(?<!!)\[\[(Worter\/[^\]|\n]*)(?:\|([^\]\n]*))?\]\]/gu;

/** A link into the dictionary, as the Scroll holds it. */
export type ScrollLink = {
	/** The note it points at, `.md` included. */
	readonly notePath: string;
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

const notePathOf = (target: string) => {
	const hash = target.indexOf("#");
	const path = (hash < 0 ? target : target.slice(0, hash)).trim();
	return path.endsWith(".md") ? path : `${path}.md`;
};

/**
 * The links into `Worter/` in the Scroll's body, with the blocks they stand
 * in. Links inside code and comments are not links.
 */
export function dictionaryLinksOf(content: string): ScrollLink[] {
	const body = scrollBodyRange(content);
	const text = content.slice(body.from, body.to);
	const links: { notePath: string; shown: SourceRange }[] = [];
	DICTIONARY_LINK.lastIndex = 0;
	for (
		let match = DICTIONARY_LINK.exec(text);
		match;
		match = DICTIONARY_LINK.exec(text)
	) {
		const [whole, target = "", alias] = match;
		const from = body.from + match.index;
		const shown =
			alias === undefined
				? { from: from + 2, to: from + 2 + target.length }
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
		links.push({ notePath: notePathOf(target), shown });
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
	/** Whether a link's target is a Lemma or Reading note path with no note at it now. */
	readonly isMissingNote: (notePath: string) => boolean;
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
	if (!recorded.some(({ blockId }) => present.has(blockId)))
		return { unkeyed, unlinked };
	const inFlux = new Set(
		links.flatMap(({ block, notePath }) =>
			block !== undefined && input.isMissingNote(notePath) ? [block] : [],
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
			if (inFlux.has(block)) continue;
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
