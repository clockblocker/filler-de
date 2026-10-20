import type {
	LemmaRecord,
	PendingSemanticRelationRecord,
	ReadingEntry,
	SurfaceEntry,
} from "dumdict";
import type * as Dumling from "dumling/types";

/** dumdict's Surface identity key. dumdict exports the type only through `SurfaceEntry`. */
export type SurfaceId<L extends Dumling.Language = Dumling.Language> =
	SurfaceEntry<L>["id"];

/**
 * A Lemma note's data layer: dumdict records only, each validated by its
 * `parseAs*` parser. Plugin-owned values live in the document layer.
 */
export type LemmaNoteData<L extends Dumling.Language> = {
	readonly lemmaRecord: LemmaRecord<L>;
	readonly readingEntries: readonly ReadingEntry<L>[];
	readonly ownedSurfaceEntries: readonly SurfaceEntry<L>[];
	readonly pendingRelations: readonly PendingSemanticRelationRecord<L>[];
};

/** The records of an invalid note that did validate. Never commit it. */
export type PartialLemmaNoteData<L extends Dumling.Language> = {
	readonly lemmaRecord: LemmaRecord<L> | undefined;
	readonly readingEntries: readonly ReadingEntry<L>[];
	readonly ownedSurfaceEntries: readonly SurfaceEntry<L>[];
	readonly pendingRelations: readonly PendingSemanticRelationRecord<L>[];
};

export type CodecOptions<L extends Dumling.Language> = {
	/** The dictionary's language; every record must be in it. */
	readonly language: L;
};
