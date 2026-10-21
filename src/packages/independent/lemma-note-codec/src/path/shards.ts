import { canonicalFormKey } from "dumling";
import type * as Dumling from "dumling/types";
import { DROPPED_CHARACTERS, graphemesOf, toNameSegment } from "./name-segment";

/** The shard folders take the first one, three and five graphemes. */
const SHARD_LENGTHS = [1, 3, 5] as const;

export type ShardFolders = readonly [string, string, string];

const WHITESPACE = /\s+/gu;
const EDGE_DOTS = /^\.+|\.+$/gu;

/**
 * The three shard folders of a spelling (ADR-0015, #108): the first one,
 * three and five graphemes of its `canonicalFormKey`, which lowercases by
 * the language's rules and keeps `ß`.
 *
 * - Whitespace is dropped, so a phrase shards as one word: `sich in Acht
 *   nehmen` gives `s/sic/sichi`. Only the shard folders drop it.
 * - What `toNameSegment` drops or trims (forbidden characters, control
 *   characters, edge dots) is gone before the graphemes are counted;
 *   leading punctuation, digits and symbols otherwise stay.
 * - A spelling shorter than a level repeats in full: `Tag` gives
 *   `t/tag/tag`.
 * - Each folder goes through `toNameSegment`, so a spelling left with
 *   nothing gives `@/@/@`, and a reserved name such as `con` is `@con`.
 *
 * The first folder is one grapheme, or `@`, so it never spells a language
 * folder.
 */
export function shardFolders(
	spelling: string,
	language: Dumling.Language,
): ShardFolders {
	const graphemes = graphemesOf(shardSource(spelling, language));
	const [one, three, five] = SHARD_LENGTHS.map((length) =>
		toNameSegment(graphemes.slice(0, length).join("")),
	);
	return [one ?? "", three ?? "", five ?? ""];
}

function shardSource(spelling: string, language: Dumling.Language): string {
	return canonicalFormKey(spelling, language)
		.normalize("NFC")
		.replace(DROPPED_CHARACTERS, "")
		.replace(WHITESPACE, "")
		.replace(EDGE_DOTS, "")
		.normalize("NFC");
}
