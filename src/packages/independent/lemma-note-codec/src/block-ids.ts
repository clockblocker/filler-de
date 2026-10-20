import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { sha256Hex } from "./hash";
import type { LemmaNoteData, SurfaceId } from "./types";

/** Hex digits a Block ID starts with, and how many a collision adds. */
export const BLOCK_ID_HASH_LENGTH = 8;
const COLLISION_STEP = 4;
const MAX_HASH_LENGTH = 64;

export const READING_BLOCK_ID_PREFIX = "r-";
export const SURFACE_BLOCK_ID_PREFIX = "s-";

export type BlockIdTarget =
	| { readonly scope: "reading"; readonly key: string }
	| { readonly scope: "surface"; readonly key: SurfaceId };

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
		const colliding = [...byId.values()].filter(
			(group) => group.length > 1,
		);
		const growable = colliding
			.flat()
			.filter((key) => (lengths.get(key) ?? 0) < MAX_HASH_LENGTH);
		if (growable.length === 0) break;
		for (const key of growable) {
			lengths.set(
				key,
				Math.min(
					(lengths.get(key) ?? 0) + COLLISION_STEP,
					MAX_HASH_LENGTH,
				),
			);
		}
	}
	return new Map(
		[...digests].map(([key, hash]) => [
			key,
			`${prefix}${hash.slice(0, lengths.get(key))}`,
		]),
	);
}

/**
 * A Reading's Block ID as a link from another note writes it: the short
 * hash, without the lengthening a collision inside its own note would add.
 */
export function readingBlockId(reading: Dumling.Reading): string {
	return `${READING_BLOCK_ID_PREFIX}${sha256Hex(readingIdentityKey(reading)).slice(0, BLOCK_ID_HASH_LENGTH)}`;
}

/** Every Block ID of a note's data, with the reverse map. Never stored. */
export type NoteBlockIds = {
	readonly readings: ReadonlyMap<string, string>;
	readonly surfaces: ReadonlyMap<SurfaceId, string>;
	/** Block ID to the `readingIdentityKey` or `SurfaceId` it hashes. */
	readonly targets: ReadonlyMap<string, BlockIdTarget>;
};

/** Derives a note's Block IDs from its records (spec: Plugin-owned values). */
export function blockIdsOf<L extends Dumling.Language>(
	data: Pick<LemmaNoteData<L>, "readingEntries" | "ownedSurfaceEntries">,
): NoteBlockIds {
	const readings = assignBlockIds(
		READING_BLOCK_ID_PREFIX,
		data.readingEntries.map((entry) => readingIdentityKey(entry.reading)),
	);
	const surfaces = assignBlockIds(
		SURFACE_BLOCK_ID_PREFIX,
		data.ownedSurfaceEntries.map((entry) => entry.id),
	) as Map<SurfaceId, string>;
	const targets = new Map<string, BlockIdTarget>([
		...[...readings].map(
			([key, id]) => [id, { key, scope: "reading" }] as const,
		),
		...[...surfaces].map(
			([key, id]) => [id, { key, scope: "surface" }] as const,
		),
	]);
	return { readings, surfaces, targets };
}
