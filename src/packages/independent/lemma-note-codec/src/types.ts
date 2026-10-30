import type {
	LemmaRecord,
	PendingSemanticRelationRecord,
	ReadingEntry,
	SurfaceEntry,
} from "dumdict";
import type * as Dumling from "dumling/types";
import type { BreakdownSettled } from "./metadata";

/** dumdict's Surface identity key. dumdict exports the type only through `SurfaceEntry`. */
export type SurfaceId<L extends Dumling.Language = Dumling.Language> =
	SurfaceEntry<L>["id"];

/**
 * Every record of one Lemma: what its Lemma note and its Reading notes hold
 * between them. Rendering either kind of note reads it, since a Lemma note
 * links its Readings and a Reading note embeds its Licence Group's table.
 */
export type LemmaRecords<L extends Dumling.Language> = {
	readonly lemmaRecord: LemmaRecord<L>;
	readonly readingEntries: readonly ReadingEntry<L>[];
	readonly ownedSurfaceEntries: readonly SurfaceEntry<L>[];
	readonly pendingRelations: readonly PendingSemanticRelationRecord<L>[];
};

/** A Lemma note's data: its Lemma Record, with its Paradigm, and its owned Surfaces. */
export type LemmaNoteData<L extends Dumling.Language> = {
	readonly lemmaRecord: LemmaRecord<L>;
	readonly ownedSurfaceEntries: readonly SurfaceEntry<L>[];
};

/** A Reading note's data: its Reading Entry and the pending relations it is the source of. */
export type ReadingNoteData<L extends Dumling.Language> = {
	readonly readingEntry: ReadingEntry<L>;
	readonly pendingRelations: readonly PendingSemanticRelationRecord<L>[];
	/** Why its Breakdown is asked no more, if it is settled with none (#266). */
	readonly breakdownSettled?: BreakdownSettled;
};

export type CodecOptions<L extends Dumling.Language> = {
	/** The dictionary's language; every record must be in it. */
	readonly language: L;
};
