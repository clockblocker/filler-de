import { lemmaIdentityKey, readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import {
	findPathCollisions,
	type PathClaim,
	type PathCollision,
} from "./path/collision";
import type { NotePath } from "./path/common";
import { lemmaNotePath, readingNotePath } from "./path/note-path";

/** Where a German Lemma's notes live (ADR-0015), and what collides among them. */
export type LemmaNotePaths = {
	readonly lemma: NotePath;
	/** Each Reading note's path, by `readingIdentityKey`. */
	readonly readings: ReadonlyMap<string, NotePath>;
	/** Each note's claim on its path, the Lemma note's first. */
	readonly claims: readonly PathClaim[];
	/**
	 * Collisions among these notes, such as two Readings whose Emoji
	 * Descriptions `toNameSegment` spells alike (`#️⃣`, `*️⃣`). Report them;
	 * never write one note over another. The store checks its claims against
	 * every other note's.
	 */
	readonly collisions: readonly PathCollision[];
};

/** The owner a path claim names: the note kind and its identity key. */
export const lemmaNoteOwner = (lemma: Dumling.Lemma): string =>
	JSON.stringify(["Lemma", lemmaIdentityKey(lemma)]);
export const readingNoteOwner = (reading: Dumling.Reading): string =>
	JSON.stringify(["Reading", readingIdentityKey(reading)]);

/**
 * The paths of a Lemma's note and its Reading notes. It throws, as the path
 * module does, only for a Lemma dumling would reject.
 */
export function notePathsOf(records: {
	readonly lemmaRecord: { readonly lemma: Dumling.Lemma<"de"> };
	readonly readingEntries: readonly {
		readonly reading: Dumling.Reading<"de">;
	}[];
}): LemmaNotePaths {
	const { lemma } = records.lemmaRecord;
	const lemmaPath = lemmaNotePath(lemma);
	const readings = new Map<string, NotePath>();
	const claims: PathClaim[] = [
		{ owner: lemmaNoteOwner(lemma), path: lemmaPath.path },
	];
	for (const { reading } of records.readingEntries) {
		const path = readingNotePath(reading);
		readings.set(readingIdentityKey(reading), path);
		claims.push({ owner: readingNoteOwner(reading), path: path.path });
	}
	return {
		claims,
		collisions: findPathCollisions(claims),
		lemma: lemmaPath,
		readings,
	};
}
