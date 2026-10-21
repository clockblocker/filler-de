import { sha256Hex } from "./hash";
import type { SurfaceId } from "./types";

/**
 * Block IDs of a Lemma note (spec: Plugin-owned values). Links and embeds
 * name them, so the hash and its length are part of the note format and
 * must never change.
 */

/** Hex digits a Block ID starts with, and how many a collision adds. */
export const BLOCK_ID_HASH_LENGTH = 8;
const COLLISION_STEP = 4;
const MAX_HASH_LENGTH = 64;

/** A met Surface's line: `^s-<hash of its SurfaceId>`. */
export const SURFACE_BLOCK_ID_PREFIX = "s-";
/** The table of a Lemma with a single Licence Group. */
export const SINGLE_TABLE_BLOCK_ID = "t";
/** A table of a Lemma with several Licence Groups: `^t-<hash of its selectionKey>`. */
export const TABLE_BLOCK_ID_PREFIX = "t-";

/**
 * Assigns each distinct key `prefix` plus a prefix of its digest. IDs start
 * at 8 hex digits; keys whose IDs collide all lengthen by 4 digits until
 * they differ, so the result depends only on the set of keys.
 */
export function assignBlockIds(
	prefix: string,
	keys: readonly string[],
	digest: (key: string) => string = sha256Hex,
): Map<string, string> {
	const digests = new Map(
		[...new Set(keys)].map((key) => [key, digest(key)]),
	);
	const lengths = new Map(
		[...digests.keys()].map((key) => [key, BLOCK_ID_HASH_LENGTH]),
	);
	for (;;) {
		const byId = new Map<string, string[]>();
		for (const [key, hash] of digests) {
			const id = hash.slice(0, lengths.get(key));
			byId.set(id, [...(byId.get(id) ?? []), key]);
		}
		const growable = [...byId.values()]
			.filter((group) => group.length > 1)
			.flat()
			.filter((key) => (lengths.get(key) ?? 0) < MAX_HASH_LENGTH);
		if (growable.length === 0) break;
		for (const key of growable)
			lengths.set(
				key,
				Math.min(
					(lengths.get(key) ?? 0) + COLLISION_STEP,
					MAX_HASH_LENGTH,
				),
			);
	}
	return new Map(
		[...digests].map(([key, hash]) => [
			key,
			`${prefix}${hash.slice(0, lengths.get(key))}`,
		]),
	);
}

/** The Block ID of each owned Surface's line, by SurfaceId. */
export function surfaceBlockIds(
	surfaces: readonly { readonly id: SurfaceId }[],
): Map<SurfaceId, string> {
	return assignBlockIds(
		SURFACE_BLOCK_ID_PREFIX,
		surfaces.map(({ id }) => id),
	) as Map<SurfaceId, string>;
}

/**
 * The Block ID of each Licence Group's table, by the group's `selectionKey`:
 * `t` when the Lemma has a single group, otherwise `t-` and a hash of the
 * key, stable while the group's Licences are. A licence change that splits
 * or merges groups changes the IDs, and the store rewrites the embeds.
 */
export function tableBlockIds(
	selectionKeys: readonly string[],
): Map<string, string> {
	const keys = [...new Set(selectionKeys)];
	if (keys.length === 1)
		return new Map([[keys[0] as string, SINGLE_TABLE_BLOCK_ID]]);
	return assignBlockIds(TABLE_BLOCK_ID_PREFIX, keys);
}

/** A codec-owned Block ID ending a line, with the whitespace before it. */
const TRAILING_BLOCK_ID =
	/(?:^|[ \t]+)\^(?:s-[0-9a-f]+|t(?:-[0-9a-f]+)?)[ \t]*$/u;

/**
 * Text without the codec-owned Block IDs that end any of its lines: an
 * edited rendering that became freeform keeps every byte but those, so
 * each ID stays once in the note, on the fresh rendering. A line that held
 * only an ID goes.
 */
export function withoutBlockIds(text: string): string {
	return text
		.split("\n")
		.flatMap((line) => {
			const cr = line.endsWith("\r") ? "\r" : "";
			const bare = cr ? line.slice(0, -1) : line;
			if (!TRAILING_BLOCK_ID.test(bare)) return [line];
			const kept = bare.replace(TRAILING_BLOCK_ID, "");
			return kept.length === 0 ? [] : [`${kept}${cr}`];
		})
		.join("\n");
}
