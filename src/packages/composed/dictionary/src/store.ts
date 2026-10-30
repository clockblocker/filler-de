import {
	ATTESTATION_REF_START,
	findPathCollisions,
	lemmaNoteOwner,
	NoteSerializeError,
	type PathClaim,
	readingNoteOwner,
} from "@textfresser/lemma-note-codec";
import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	isContentConflict,
	type VamActionFailureKind,
	type VamUndoReport,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
	vaultActionTargetPath,
} from "@textfresser/vault-action-manager";
import { canonicalJson } from "common-utils";
import {
	type AttestationLink,
	type CommitChangesRequest,
	type CommitChangesResult,
	type DumdictPlan,
	ParsingError,
	type PendingSemanticRelationRecord,
	parseAsCommitChangesRequest,
	type StoreRevision,
	type SurfaceEntry,
} from "dumdict";
import {
	type CleanupRelationsSlice,
	createDumdictPlanner,
	type DumdictPlanOutcome,
	type LoadReadingEntryContextRequest,
	type OccurrenceSlice,
	type OccurrenceSliceRequest,
	type ReadingEntryContext,
	type ReevaluateShadowsRequest,
	type ReevaluateShadowsSlice,
	type RekeySurfacesSlice,
	type RekeySurfacesSliceRequest,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { Cause, Clock, Data, Effect, Fiber, Result, Semaphore } from "effect";
import { contentHash } from "./content-hash";
import {
	CrossroadNoteMetadata,
	crossroadMetadataOf,
	crossroadUserText,
	writeCrossroadNote,
} from "./crossroad";
import {
	type DictionaryCommitError,
	DictionaryPathOccupiedError,
	DictionaryPlanError,
	DictionaryRefRewriteError,
	DictionaryRequestError,
	DictionaryRoundTripError,
	DictionaryScanError,
	DictionaryTransactionConflict,
	DictionaryWriteError,
} from "./errors";
import {
	freeformOfNote,
	holdsFreeform,
	placedFreeform,
	placedNoteProblem,
} from "./freeform";
import {
	type WriteOptions,
	writeLemmaNote,
	writeReadingNote,
} from "./internal/dictionary-notes";
import {
	LemmaNoteMetadata,
	type MetadataFormat,
	type MetadataNamespace,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "./internal/note-metadata";
import {
	formKeyOf,
	lemmaKeyOf,
	pendingShadowKeyOf,
	readingKeyOf,
	shadowKeyOf,
} from "./keys";
import {
	cacheHit,
	type DictionaryNoteCache,
	fromCached,
	toCached,
} from "./note-cache";
import {
	byCodeUnit,
	canonicalData,
	canonicalLemmaPath,
	canonicalReadingPath,
	NoteIndex,
	type ReadingLocation,
	type RelationEdge,
} from "./note-index";
import {
	classifyFile,
	type NoteData,
	type PathEntry,
	type QuarantineReason,
	sameEntry,
	unreadableEntry,
} from "./notes";
import { planned } from "./plan";
import {
	crossroadContentOf,
	crossroadPathOf,
	type DisplacedCrossroad,
	displacedCrossroads,
	fanOutOf,
	type NoteProjections,
	renderOptionsFor,
	staleCrossroads,
	staleTables,
} from "./render";
import {
	basenameKeyOf,
	basenameRefNames,
	type DeferredRefs,
	type HeldRef,
	planRefRewrite,
	type RefRewrite,
	retargetForRenames,
	retargetForRepairs,
	retargetForShadows,
	type ScrollLookup,
	type ScrollRefNames,
	type ScrollRename,
	scrollRefNamesOf,
	scrollRenamesOf,
} from "./scroll-refs";
import {
	loadCleanupRelationsContext,
	loadReevaluateShadowsContext,
} from "./slices";
import { stageChanges } from "./stage-changes";
import type { Transaction, TransactOptions } from "./transaction";
import {
	DICTIONARY_CALLER,
	DICTIONARY_EVENTS,
	type DictionaryVault,
	folderSplitPath,
	formatPath,
	inScope,
	isUnder,
	mdSplitPath,
	WORTER_SPLIT_PATH,
} from "./vault";
import {
	type DictionaryView,
	type LemmaCandidate,
	type StoredLemmaNote,
	viewOf,
} from "./view";

export type { LemmaCandidate } from "./view";

/** A note the store does not read as data, and why. */
export type QuarantinedNote =
	| { readonly path: string; readonly reason: QuarantineReason }
	| {
			readonly path: string;
			readonly reason: {
				readonly _tag: "DuplicateLemma" | "DuplicateReading";
				/** The note that holds the Lemma or Reading instead. */
				readonly heldBy: string;
			};
	  }
	| {
			readonly path: string;
			/** A Reading note whose Lemma no readable Lemma note holds. */
			readonly reason: { readonly _tag: "OrphanReading" };
	  }
	| {
			readonly path: string;
			/** A Lemma whose notes disagree, such as a Paradigm licensing a Reading without a note. */
			readonly reason: {
				readonly _tag: "InconsistentLemma";
				readonly message: string;
			};
	  };

/** A note whose path disagrees with its metadata and that stays put. */
export type HealingBlocked = {
	readonly path: string;
	readonly canonicalPath: string | undefined;
	readonly message: string;
};

/** What the user should hear about `Worter/`. Reported without throwing. */
export type DictionaryDiagnostics = {
	readonly quarantined: readonly QuarantinedNote[];
	readonly healingBlocked: readonly HealingBlocked[];
	/**
	 * Notes directly in `Worter/` without dictionary metadata that are still
	 * there: named as Obsidian names a new note (`Untitled`), or kept by
	 * healing, which says why in `healingBlocked`.
	 */
	readonly strays: readonly string[];
	/** Empty files at exact Lemma or Reading note paths, left alone. */
	readonly emptyNotes: readonly string[];
	/** Folders or files the last full scan could not read. */
	readonly scanIssues: readonly string[];
};

export type DumdictVaultStoreOptions = {
	readonly vault: DictionaryVault;
	/** A `(path, mtime)` cache that lets startup skip unchanged notes. */
	readonly cache?: DictionaryNoteCache;
	/**
	 * Projections the codec renders into every note the store writes. The
	 * store resolves links and fills the `inverse_relation` Block itself.
	 */
	readonly projections?: NoteProjections;
	/**
	 * Where notes keep their metadata: the format "Hide metadata" selects.
	 * Hidden when absent.
	 */
	readonly metadataFormat?: () => MetadataFormat;
	/**
	 * Run after the index is built or changes, with the current diagnostics,
	 * so what it logs lands under the store's span.
	 */
	readonly onDiagnostics?: (
		diagnostics: DictionaryDiagnostics,
	) => Effect.Effect<void>;
	/** Run after a run re-rendered the tables of notes rendered at other versions (#121). */
	readonly onTablesRerendered?: (
		report: TablesRerendered,
	) => Effect.Effect<void>;
};

/**
 * What one run of the table re-render did (#121): the Lemmas whose notes
 * now record the current pack and Table Schema versions, the notes it
 * wrote for them (their Lemma notes, and the Reading notes whose embed
 * moved), and the Lemmas still stale, which the next full read tries again.
 */
export type TablesRerendered = {
	readonly lemmas: number;
	readonly notes: number;
	readonly remaining: number;
};

/**
 * dumdict's host over the vault: a Lemma note per Lemma, a Reading note per
 * Reading and a Crossroad note per spelling under `Worter/` (ADR-0015).
 * Reads come from an immutable version of an in-memory index kept current
 * through VAM's events; commits are serialized, checked against a staged
 * fork of the index, and written as stop-on-first-failure batches in a
 * fixed order (`commitChanges`). The store never overwrites content it did
 * not write: creates fail on an existing file, rewrites compare-and-swap on
 * the content they read, and user text in a note it removes moves to a
 * note that stays. A pending relation lives only in its source's Reading
 * note; its link points at its target's Crossroad path, which Obsidian
 * shows as an uncreated link until a note is there.
 */
export type DumdictVaultStore = {
	/** dumdict's Reading Entry slice for one planner request. */
	readonly loadReadingEntryContext: (
		request: LoadReadingEntryContextRequest<"de">,
	) => Effect.Effect<ReadingEntryContext<"de">, DictionaryRequestError>;
	/** dumdict's `cleanupRelations` slice. */
	readonly loadCleanupRelationsContext: (request: {
		readonly resolutions: readonly {
			readonly locator: PendingSemanticRelationRecord<"de">["locator"];
		}[];
	}) => Effect.Effect<CleanupRelationsSlice<"de">, DictionaryRequestError>;
	/** dumdict's `reevaluateShadows` slice. */
	readonly loadReevaluateShadowsContext: (
		request: Omit<ReevaluateShadowsRequest<"de">, "baseRevision">,
	) => Effect.Effect<ReevaluateShadowsSlice<"de">, DictionaryRequestError>;
	/** dumdict's `removeOccurrence` and `reconcileAttestationLinks` slice. */
	readonly loadOccurrenceSlice: (
		request: OccurrenceSliceRequest,
	) => Effect.Effect<OccurrenceSlice<"de">>;
	/** dumdict's `rekeySurfaces` slice. */
	readonly loadRekeySurfacesSlice: (
		request: RekeySurfacesSliceRequest<"de">,
	) => Effect.Effect<RekeySurfacesSlice<"de">>;
	/**
	 * Applies a plan against its base revision. A conflict writes nothing.
	 *
	 * The writes go as stop-on-first-failure batches in this order:
	 *
	 * 1. creates of new Lemma and Reading notes;
	 * 2. rewrites of the notes whose records change;
	 * 3. re-renders of other notes whose links or inverse relations move,
	 *    and of the Crossroad notes of every spelling the change touches;
	 * 4. removed Reading notes, then removed Lemma notes, to the trash.
	 *
	 * A failure among the creates removes the notes it created, through
	 * VAM's guarded `dispatchOrUndo`, and answers a conflict, as if nothing
	 * was written; a note it could not remove, such as one typed into
	 * meanwhile, makes it a `DictionaryWriteError`. A later failure rebuilds the
	 * index from the files and writes what is still missing once more; only
	 * if that fails too is a `DictionaryWriteError` returned, with the index
	 * rebuilt. Every rebuild re-evaluates the stored Shadows the files'
	 * Lemmas no longer fit, so links converge. A commit that adds or removes
	 * Lemmas is followed by that re-evaluation too, as its own commit.
	 */
	readonly commitChanges: (
		request: CommitChangesRequest<"de"> | DumdictPlan<"de">,
	) => Effect.Effect<CommitChangesResult, DictionaryCommitError>;
	/**
	 * Plans and commits under the store's lock, so no other commit, event
	 * or rescan lands between the read and the write. `plan` reads one
	 * index version through its view and answers a `Transaction`: a plan to
	 * commit, a plan to commit and plan again after, or a value to stop
	 * with. It is synchronous, so nothing it does can wait on a model or a
	 * timer while the lock is held; work like that goes before the
	 * transaction, and a plan that finds it stale stops for its caller to
	 * redo it and transact again.
	 *
	 * A commit that fails because of a change made outside the store (a
	 * file ahead of the index, a compare-and-swap that found other content,
	 * a create whose path was taken) plans again from the files as they are
	 * now, after releasing the lock so pending events land. So does a plan
	 * that answers `Replan`. After `maxAttempts` plans the transaction
	 * fails with `DictionaryTransactionConflict`. A write VAM failed as
	 * `io` (`DictionaryWriteError.transient`) plans again once, after a
	 * pause, within the attempts; any other commit failure fails it at
	 * once. Never call the store's locked operations
	 * (`commitChanges`, `transact`, `rescan`, `appendFreeform`,
	 * `refreshTables`) from inside `plan`: the lock is not reentrant.
	 */
	readonly transact: <A, E = never>(
		plan: (view: DictionaryView) => Result.Result<Transaction<A>, E>,
		options?: TransactOptions,
	) => Effect.Effect<
		A,
		E | DictionaryCommitError | DictionaryTransactionConflict
	>;
	/** The current revision; it moves on every observed change under `Worter/`. */
	readonly revision: Effect.Effect<StoreRevision>;

	/** Stored Lemmas whose Canonical Form or owned Surface is one of these texts. */
	readonly lemmaCandidates: (
		texts: readonly string[],
	) => Effect.Effect<LemmaCandidate[]>;
	/** A Lemma's note path and records, with its Paradigm, if it is stored. */
	readonly lemmaNote: (
		lemma: Dumling.Lemma<"de">,
	) => Effect.Effect<StoredLemmaNote | undefined>;
	/** Every stored Lemma and the path of its Lemma note, by path. */
	readonly lemmaNotes: Effect.Effect<
		readonly {
			readonly path: string;
			readonly lemma: Dumling.Lemma<"de">;
		}[]
	>;
	/**
	 * Every stored Attestation Link whose ref starts with `prefix`, such as
	 * the refs into one Scroll.
	 */
	readonly attestationLinksWithRefPrefix: (
		prefix: string,
	) => Effect.Effect<readonly AttestationLink<"de">[]>;
	/** Where a Reading lives: its Reading note and its Lemma note. */
	readonly readingLocation: (
		reading: Dumling.Reading<"de">,
	) => Effect.Effect<ReadingLocation | undefined>;
	/**
	 * How Attestation Refs name the Scroll at `scrollPath` for a new ref of
	 * `reading` (#198, #210): the link path the ref takes, by the rule the
	 * store's rename rewrite follows, resolved from the Reading's note, the
	 * one it has or the one its commit creates (its basename when Obsidian
	 * opens the Scroll for it from there, its path otherwise), and every
	 * spelling stored refs name it by from the notes holding them. It never
	 * fails: when Obsidian cannot be asked, it answers the basename, unless
	 * a note the Reading's commit creates has it, and logs a warning. The
	 * notes the commit creates include the Crossroad notes of the Lemma's
	 * and the Surface's spellings that are not there yet.
	 */
	readonly scrollRefNames: (
		scrollPath: string,
		reading: Dumling.Reading<"de">,
		/** The occurrence's Surface, whose Crossroad note the commit may create. */
		surface?: Dumling.Surface<"de">,
	) => Effect.Effect<ScrollRefNames>;
	readonly surface: (
		surfaceId: SurfaceEntry<"de">["id"],
	) => Effect.Effect<SurfaceEntry<"de"> | undefined>;
	/** Stored relations whose target is this Lemma or one of its Readings. */
	readonly relationEdgesTo: (
		lemma: Dumling.Lemma<"de">,
	) => Effect.Effect<RelationEdge[]>;
	readonly diagnostics: Effect.Effect<DictionaryDiagnostics>;
	/** Rebuilds the index from a full scan of `Worter/`. */
	readonly rescan: Effect.Effect<void, DictionaryScanError>;
	/**
	 * Waits until the store has handled every vault change VAM heard before
	 * the call, such as another caller's dispatch that just finished, so a
	 * commit after it plans against them. It never fails: a change the store
	 * could not apply leaves the index stale, and the next commit rebuilds.
	 */
	readonly caughtUp: Effect.Effect<void>;
	/**
	 * Re-renders the notes of every Lemma whose Lemma note records other
	 * table versions than the projections render now (#121). Every full
	 * read of `Worter/` (startup, a rescan, a rebuild) starts it in the
	 * background, in chunks that each hold the writer lock briefly; this
	 * waits for the run in flight, or runs one, and answers what it did.
	 */
	readonly refreshTables: Effect.Effect<TablesRerendered>;
	/**
	 * Places user text as freeform in a stored Lemma or Reading note: under
	 * a Reading note's Note title, in place of its placeholder, or last in a
	 * Lemma note. It changes no record, writes only through a
	 * compare-and-swap on the content it read, and answers `AlreadyThere`
	 * when the note already holds the text as freeform.
	 */
	readonly appendFreeform: (request: {
		readonly path: string;
		readonly text: string;
	}) => Effect.Effect<
		"Appended" | "AlreadyThere",
		DictionaryRequestError | DictionaryScanError
	>;
	/** Stops observing the vault. */
	readonly close: Effect.Effect<void>;
};

const message = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);

/**
 * A rewrite that lands only on the content it was planned from: VAM checks
 * `expected` inside the `Vault.process` call that writes, and reports a
 * `conflict` without writing when the file holds anything else.
 */
function compareAndSwap(
	path: string,
	expected: string,
	next: string,
): VaultAction {
	return {
		kind: VaultActionKind.ProcessMdFile,
		payload: {
			expected,
			splitPath: mdSplitPath(path),
			transform: () => next,
		},
	};
}

/** A note created only where no file is; VAM fails it with `exists` otherwise. */
function createNote(path: string, content: string): VaultAction {
	return {
		kind: VaultActionKind.CreateMdFile,
		payload: { content, splitPath: mdSplitPath(path) },
	};
}

/**
 * How VAM fails a write that found its file changed by someone else; it
 * wrote nothing (`Failed` in the dispatch report).
 */
const EXTERNAL_CHANGE_KINDS: ReadonlySet<VamActionFailureKind> = new Set([
	"conflict",
	"exists",
	"missing",
]);

/** The index was behind the file at `path`: the caller re-reads and re-plans. */
class StaleRead extends Data.TaggedError("StaleRead")<{
	readonly path: string;
}> {}

/**
 * The notes a stopped create phase leaves behind: those VAM's undo could
 * not trash (one gone already is not left), Uncertain creates it found
 * landed among them. Without an undo report, every create that landed.
 */
function createsLeft(
	landed: readonly { readonly path: string }[],
	undo: VamUndoReport | undefined,
): string[] {
	if (!undo) return landed.map(({ path }) => path);
	return undo.couldNotUndo
		.filter(({ block }) => block !== "Missing")
		.map(({ action }) => vaultActionTargetPath(action));
}

/** The order a commit's writes land in; see `commitChanges`. */
const Phase = {
	Create: 0,
	FanOut: 2,
	Own: 1,
	TrashLemmas: 4,
	TrashReadings: 3,
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const PHASES: readonly Phase[] = [0, 1, 2, 3, 4];

type PlannedWrite = {
	readonly phase: Phase;
	readonly path: string;
	readonly action: VaultAction;
	/** The content the write leaves; undefined for a note sent to the trash. */
	readonly content: string | undefined;
	/** The identity a created note claims its path for. */
	readonly owner?: string;
	/** The Lemma whose note it is, or the form key of the Crossroad note it is. */
	readonly lemmaKey?: string;
	readonly formKey?: string;
};

/** Notes a commit left to be re-rendered after it, by path and identity. */
type Deferred = {
	readonly paths: Set<string>;
	readonly lemmaKeys: Set<string>;
	readonly formKeys: Set<string>;
};

/** What a commit means to leave: each touched Lemma's records, or none. */
type Intended = ReadonlyMap<string, NoteData | undefined>;

/** Whether a namespace holds the same value in two contents. */
function sameMetadata<T>(
	left: string,
	right: string,
	namespace: MetadataNamespace<T>,
): boolean {
	return (
		canonicalJson(
			noteMetadataHelper.read(left, namespace, "Hidden") ?? null,
		) ===
		canonicalJson(
			noteMetadataHelper.read(right, namespace, "Hidden") ?? null,
		)
	);
}

const sameJson = (left: unknown, right: unknown) =>
	canonicalJson(left) === canonicalJson(right);

/** Record lists compared without order. */
const sameSet = (left: readonly unknown[], right: readonly unknown[]) =>
	sameJson(
		left.map((value) => canonicalJson(value)).sort(),
		right.map((value) => canonicalJson(value)).sort(),
	);

/** A Reading's records in a Lemma's: its entry and the pending relations it is the source of. */
function readingRecords(data: NoteData, readingKey: string) {
	return {
		entry: data.readingEntries.find(
			({ reading }) => readingKeyOf(reading) === readingKey,
		),
		pending: data.pendingRelations.filter(
			({ sourceReading }) => readingKeyOf(sourceReading) === readingKey,
		),
	};
}

/** Each of a Lemma's notes' records, as one string per note, by note. */
function noteStates(data: NoteData | undefined): Map<string, string> {
	const states = new Map<string, string>();
	if (data === undefined) return states;
	const sorted = (list: readonly unknown[]) =>
		list.map((value) => canonicalJson(value)).sort();
	states.set(
		"lemma",
		canonicalJson([data.lemmaRecord, sorted(data.ownedSurfaceEntries)]),
	);
	for (const { reading } of data.readingEntries) {
		const key = readingKeyOf(reading);
		const { entry, pending } = readingRecords(data, key);
		states.set(key, canonicalJson([entry, sorted(pending)]));
	}
	return states;
}

/**
 * Whether every note of a Lemma holds what the commit read or what it
 * meant to write: only then does finishing a stopped commit overwrite
 * nothing another writer changed meanwhile.
 */
function onlyThisCommitChanged(
	current: NoteData | undefined,
	base: NoteData | undefined,
	intended: NoteData | undefined,
): boolean {
	const now = noteStates(current);
	const was = noteStates(base);
	const meant = noteStates(intended);
	for (const key of new Set([
		...now.keys(),
		...was.keys(),
		...meant.keys(),
	])) {
		const state = now.get(key);
		if (state !== was.get(key) && state !== meant.get(key)) return false;
	}
	return true;
}

/** Whether a stored Shadow relation no longer fits the Lemmas its Shadow names. */
function unsettled(
	view: NoteIndex,
	record: PendingSemanticRelationRecord<"de">,
): boolean {
	const matches = view.lemmasNamedBy(pendingShadowKeyOf(record));
	const [only] = matches;
	if (record.resolvedLemma !== undefined)
		return !(
			matches.length === 1 && only === lemmaKeyOf(record.resolvedLemma)
		);
	return (
		matches.length === 1 && only !== lemmaKeyOf(record.sourceReading.lemma)
	);
}

/** Shadows re-evaluated by one plan, to keep its relation slice small. */
const REEVALUATION_CHUNK = 8;

/** Follow-up re-evaluations a commit may start, nested. */
const MAX_FOLLOW_UP_DEPTH = 2;

/** Plans one `transact` tries before it gives up, unless told otherwise. */
const DEFAULT_TRANSACT_ATTEMPTS = 4;

/** How long `transact` waits, outside the lock, before it plans again after an `io` failure. */
const TRANSIENT_RETRY_DELAY = "100 millis";

/** Plans a ref rewrite tries: each may meet a Reading note Obsidian's link updater rewrote. */
const REF_REWRITE_ATTEMPTS = 8;

/**
 * Merges of one displaced Crossroad note tried in a row while its trash is
 * refused, as text typed into it meanwhile refuses it.
 */
const MERGE_ATTEMPTS = 3;

/** How long refs a rename left to their old name's owner wait for that owner's own rename (#199). */
const DEFERRED_REFS_TTL_MS = 60_000;

/** Lemmas whose tables one hold of the writer lock re-renders. */
const TABLES_CHUNK = 32;

let sessionCounter = 0;

/**
 * Builds the store: subscribes to VAM's events, builds the index from a
 * scan of `Worter/`, heals notes whose path disagrees with their metadata,
 * and re-evaluates the Shadows the files' Lemmas no longer fit. VAM's
 * `startListening` stays with the plugin.
 */
export const makeDumdictVaultStore = Effect.fnUntraced(function* (
	options: DumdictVaultStoreOptions,
): Effect.fn.Return<DumdictVaultStore, DictionaryScanError> {
	const { vault, cache, projections } = options;
	const metadataFormat = options.metadataFormat ?? (() => "Hidden" as const);
	const planner = createDumdictPlanner("de");
	const lock = yield* Semaphore.make(1);
	sessionCounter += 1;
	const startedAt = yield* Clock.currentTimeMillis;
	const session = `${startedAt.toString(36)}${sessionCounter.toString(36)}`;
	/** The published index version; replaced, never changed, under the lock. */
	let index = new NoteIndex();
	let counter = 0;
	let stale = false;
	let healingBlocked: HealingBlocked[] = [];
	let scanIssues: string[] = [];
	let lastDiagnostics = "";
	/** Heal moves that failed, by `moveKey`, with the note's hash then. */
	const failedMoves = new Map<string, string>();
	const moveKey = (from: string, to: string) => `${from}\u0000${to}`;

	const revision = (): StoreRevision => `vault:${session}:${counter}`;
	/** Swaps in a new index version together with the next revision. */
	const publish = (next: NoteIndex) => {
		index = next;
		counter += 1;
	};
	/**
	 * Swaps in an index version that differs only in rendered projections.
	 * No record changed, so plans made at the current revision stay valid.
	 */
	const publishRendering = (next: NoteIndex) => {
		index = next;
	};
	const markStale = Effect.sync(() => {
		stale = true;
	});
	/**
	 * The basenames, by `basenameKeyOf`, of notes that appeared in the index
	 * since refs were last checked against them: a new note may take a
	 * Scroll's basename from refs beside it (#210, `repairShadowedRefs`).
	 */
	let appeared = new Set<string>();

	const diagnosticsOf = (view: NoteIndex): DictionaryDiagnostics => {
		const quarantined: QuarantinedNote[] = [];
		const strays: string[] = [];
		const emptyNotes: string[] = [];
		for (const entry of view.allEntries()) {
			if (entry.kind === "quarantined")
				quarantined.push({ path: entry.path, reason: entry.reason });
			if (entry.kind === "stray") strays.push(entry.path);
			if (entry.kind === "empty") emptyNotes.push(entry.path);
		}
		for (const problem of view.problems()) {
			const { path } = problem;
			switch (problem._tag) {
				case "OrphanReading":
					quarantined.push({ path, reason: { _tag: problem._tag } });
					break;
				case "InconsistentLemma":
					quarantined.push({
						path,
						reason: {
							_tag: problem._tag,
							message: problem.message,
						},
					});
					break;
				case "DuplicateLemma":
				case "DuplicateReading":
					quarantined.push({
						path,
						reason: { _tag: problem._tag, heldBy: problem.heldBy },
					});
			}
		}
		quarantined.sort((a, b) => byCodeUnit(a.path, b.path));
		return {
			emptyNotes: emptyNotes.sort(byCodeUnit),
			healingBlocked,
			quarantined,
			scanIssues,
			strays: strays.sort(byCodeUnit),
		};
	};

	const report = Effect.suspend(() => {
		if (!options.onDiagnostics) return Effect.void;
		const diagnostics = diagnosticsOf(index);
		const fingerprint = JSON.stringify(diagnostics);
		if (fingerprint === lastDiagnostics) return Effect.void;
		lastDiagnostics = fingerprint;
		return options.onDiagnostics(diagnostics);
	});

	/**
	 * VAM's stop-on-first-failure dispatch. VAM finishes a batch it accepted,
	 * so the store waits for it rather than release its lock mid-write; an
	 * interrupt before that still leaves the index stale.
	 */
	const dispatch = (actions: readonly VaultAction[]) =>
		Effect.uninterruptible(
			vault.dispatchStopOnFirstFailure(actions, {
				caller: DICTIONARY_CALLER,
			}),
		).pipe(Effect.onInterrupt(() => markStale));

	/**
	 * The creates' dispatch: VAM's `dispatchOrUndo`, which on a failure
	 * trashes each note the batch created while it holds what it was
	 * created with, and probes an uncertain create rather than assume it.
	 */
	const dispatchOrUndo = (actions: readonly VaultAction[]) =>
		Effect.uninterruptible(
			vault.dispatchOrUndo(actions, { caller: DICTIONARY_CALLER }),
		).pipe(Effect.onInterrupt(() => markStale));

	/** Reads one path into its entry; undefined when no file is there. */
	const readEntry = Effect.fnUntraced(function* (path: string) {
		const splitPath = mdSplitPath(path);
		const present = yield* vault
			.exists(splitPath)
			.pipe(Effect.orElseSucceed(() => true));
		if (!present) {
			cache?.delete(path);
			return undefined;
		}
		const read = yield* Effect.result(vault.readContentWithStat(splitPath));
		if (read._tag === "Failure") {
			cache?.delete(path);
			return unreadableEntry(path, message(read.failure));
		}
		const entry = classifyFile(path, read.success.content);
		const cached = toCached(entry, read.success.stat);
		if (cached) cache?.set(path, cached);
		return entry;
	});

	type Change = {
		readonly path: string;
		readonly before: PathEntry | undefined;
		readonly entry: PathEntry | undefined;
	};

	/**
	 * Re-reads paths from the files and publishes what changed as one new
	 * index version. A path whose content hash matches what was indexed,
	 * such as an echo of the store's own write, changes nothing.
	 */
	const rereadChanges = Effect.fnUntraced(function* (
		paths: Iterable<string>,
	) {
		const changes: Change[] = [];
		for (const path of new Set(paths)) {
			if (!inScope(path)) continue;
			const entry = yield* readEntry(path);
			const before = index.entry(path);
			if (!sameEntry(before, entry))
				changes.push({ before, entry, path });
		}
		if (changes.length === 0) return changes;
		const next = index.clone();
		for (const { before, path, entry } of changes) {
			next.set(path, entry);
			if (before === undefined && entry !== undefined)
				appeared.add(basenameKeyOf(path));
		}
		publish(next);
		return changes;
	});

	const scanError = (what: string) => (cause: unknown) =>
		new DictionaryScanError({
			cause,
			message: `Could not ${what} ${WORTER_SPLIT_PATH.basename}/: ${message(cause)}`,
		});

	/** Rebuilds the index from a full scan of `Worter/`. Holds no lock itself. */
	const rebuild = Effect.fnUntraced(function* () {
		const present = yield* vault
			.exists(WORTER_SPLIT_PATH)
			.pipe(Effect.mapError(scanError("check for")));
		const next = new NoteIndex();
		let issues: string[] = [];
		if (present) {
			const scan = yield* vault
				.scanWithStat(WORTER_SPLIT_PATH)
				.pipe(Effect.mapError(scanError("scan")));
			issues = scan.diagnostics.map(
				(diagnostic) =>
					`${diagnostic.path}: ${message(diagnostic.cause)}`,
			);
			const notes = yield* Effect.forEach(
				scan.entries,
				(entry) => {
					if (entry.kind !== "MdFile")
						return Effect.succeed(undefined);
					const path = formatPath(entry);
					const cached = cache?.get(path);
					if (cacheHit(cached, entry.stat))
						return Effect.succeed(fromCached(path, cached));
					return entry.read().pipe(
						Effect.map((content) => {
							const note = classifyFile(path, content);
							const fresh = toCached(note, entry.stat);
							if (fresh) cache?.set(path, fresh);
							return note;
						}),
						Effect.catch((cause) =>
							Effect.succeed(
								unreadableEntry(path, message(cause)),
							),
						),
					);
				},
				{ concurrency: 16 },
			);
			for (const note of notes) if (note) next.set(note.path, note);
		}
		scanIssues = issues;
		stale = false;
		publish(next);
		yield* startTables();
	});

	/** Rebuilds after a write whose outcome is uncertain; never fails. */
	const recover = rebuild().pipe(
		Effect.as(true),
		Effect.catch((error) =>
			Effect.logError("Dictionary index rebuild failed", error).pipe(
				Effect.andThen(
					Effect.sync(() => {
						stale = true;
						// Old plans must not commit against an index that may be wrong.
						counter += 1;
						return false;
					}),
				),
			),
		),
	);

	/**
	 * Where a displaced note may go: undefined when its path is free, else
	 * why it stays. A file there, or a folder of it the vault spells another
	 * way, blocks a move (ADR-0015's collision rules).
	 */
	const blockedAt = Effect.fnUntraced(function* (to: string) {
		const collision = index.folderCollision(to);
		if (collision !== undefined)
			return `Its folder ${collision.folder} collides with ${collision.existing}`;
		const occupied =
			index.sameFileAs(to).length > 0 ||
			(yield* vault
				.exists(mdSplitPath(to))
				.pipe(Effect.orElseSucceed(() => true)));
		return occupied
			? "Another file sits at its own path; the two may be duplicates"
			: undefined;
	});

	/**
	 * Moves notes whose path disagrees with what they are to their own path,
	 * unless a file is already there: Lemma and Reading notes by their
	 * metadata, and displaced Crossroad notes, strays included, to their
	 * spelling's Crossroad path (`displacedCrossroads`). Lemma, Reading and
	 * moved Crossroad notes move through Obsidian's link-preserving rename,
	 * strays without it, so their links keep their text. A displaced note whose spelling's Crossroad note is already there is
	 * merged into it instead (`mergeDisplaced`). The index learns the outcome
	 * from the files, not from what the move was meant to do; a move that
	 * fails or lands elsewhere rebuilds the index and heals once more.
	 * Answers the Crossroad paths it moved or merged notes to, which the
	 * caller fills.
	 */
	const heal = Effect.fnUntraced(function* (
		retry = true,
	): Effect.fn.Return<ReadonlySet<string>> {
		const blocked: HealingBlocked[] = [];
		const moves: {
			from: string;
			to: string;
			hash: string;
			/** Whether links to it follow it: not for a stray, see below. */
			updateLinks: boolean;
		}[] = [];
		const tried = (from: string, to: string, hash: string) => {
			if (failedMoves.get(moveKey(from, to)) !== hash) return false;
			blocked.push({
				canonicalPath: to,
				message:
					"Moving it to its own path failed; the store tries again once the note changes",
				path: from,
			});
			return true;
		};
		for (const { from, to } of index.misplaced()) {
			if (to === undefined) {
				blocked.push({
					canonicalPath: undefined,
					message:
						"Its identity has no path the path module can spell",
					path: from,
				});
				continue;
			}
			const moving = index.entry(from);
			if (moving === undefined || tried(from, to, moving.hash)) continue;
			const reason = yield* blockedAt(to);
			if (reason === undefined)
				moves.push({ from, hash: moving.hash, to, updateLinks: true });
			else
				blocked.push({
					canonicalPath: to,
					message: reason,
					path: from,
				});
		}
		const merges: DisplacedCrossroad[] = [];
		const crossroadMoves: PathClaim[] = [];
		for (const displaced of displacedCrossroads(index)) {
			const { from, to } = displaced;
			const moving = index.entry(from);
			if (moving === undefined || tried(from, to, moving.hash)) continue;
			const [occupiedAt] = index.sameFileAs(to);
			const occupant =
				occupiedAt === to ? index.entry(occupiedAt) : undefined;
			if (
				occupant?.kind === "crossroad" &&
				(occupant.key === undefined || occupant.key === displaced.key)
			) {
				merges.push(displaced);
				continue;
			}
			const reason = yield* blockedAt(to);
			if (reason === undefined) {
				// Links to a stray are bare, `[[Fahrer]]`, and Obsidian's link
				// updater would rewrite them to the new name, `[[fahrer]]`, in
				// the user's texts (#102). Left as they are, they resolve to the
				// Crossroad note by name. A moved Crossroad note's links are
				// path-qualified and aliased, so they follow it back.
				moves.push({
					from,
					hash: moving.hash,
					to,
					updateLinks: displaced.kind === "crossroad",
				});
				crossroadMoves.push({ owner: from, path: to });
			} else
				blocked.push({
					canonicalPath: to,
					message: reason,
					path: from,
				});
		}
		// Two notes of one spelling: the first moves, the second merges after.
		const later = new Set(
			findPathCollisions(crossroadMoves).map(
				({ second }) => second.owner,
			),
		);
		for (const from of later) {
			const at = moves.findIndex((move) => move.from === from);
			const [move] = moves.splice(at, 1);
			if (move)
				blocked.push({
					canonicalPath: move.to,
					message:
						"Another note of its spelling moves there first; it is merged into that one",
					path: from,
				});
		}
		const healed = new Set<string>();
		for (const displaced of merges)
			if (yield* mergeDisplaced(displaced, blocked))
				healed.add(displaced.to);
		healingBlocked = blocked;
		if (moves.length > 0) {
			const outcome = yield* Effect.result(
				dispatch(
					moves.map(
						({ from, to, updateLinks }): VaultAction => ({
							kind: VaultActionKind.RenameMdFile,
							payload: {
								from: mdSplitPath(from),
								to: mdSplitPath(to),
								...(updateLinks ? {} : { updateLinks }),
							},
						}),
					),
				),
			);
			if (outcome._tag === "Failure")
				yield* Effect.logWarning(
					"Dictionary healing stopped; rebuilding the index",
					outcome.failure,
				);
			for (const { from } of moves) cache?.delete(from);
			yield* rereadChanges(moves.flatMap(({ from, to }) => [from, to]));
			// A move that failed or landed elsewhere, such as VAM renaming it
			// aside on a collision, is found by reading everything again; it is
			// not tried again until its note changes.
			const landed = ({ hash, to }: (typeof moves)[number]) =>
				index.entry(to)?.hash === hash;
			for (const move of moves) if (landed(move)) healed.add(move.to);
			if (outcome._tag === "Failure" || !moves.every(landed)) {
				const rebuilt = yield* recover;
				for (const move of moves) {
					const left = index.entry(move.from);
					if (!landed(move) && left !== undefined)
						failedMoves.set(moveKey(move.from, move.to), left.hash);
				}
				if (!(rebuilt && retry)) return healed;
				return new Set([...healed, ...(yield* heal(false))]);
			}
		}
		if (later.size > 0 && retry)
			return new Set([...healed, ...(yield* heal(false))]);
		return healed;
	});

	/** A conflict that reports the revision the caller should re-plan at. */
	const conflict = (
		code: "revisionConflict" | "semanticPreconditionFailed",
	): CommitChangesResult => ({
		code,
		latestRevision: revision(),
		status: "conflict",
	});

	/**
	 * A note's content as the index read it. A file ahead of the index holds
	 * an edit no event has delivered yet: the caller re-reads and re-plans.
	 */
	const readCurrent = Effect.fnUntraced(function* (
		view: NoteIndex,
		path: string,
	) {
		const read = yield* Effect.result(
			vault.readContentWithStat(mdSplitPath(path)),
		);
		const indexed = view.entry(path);
		if (
			read._tag === "Failure" ||
			indexed === undefined ||
			contentHash(read.success.content) !== indexed.hash
		)
			return yield* new StaleRead({ path });
		return read.success.content;
	});

	/** A path's file must not exist yet; an unindexed one is an index behind the files. */
	const assertAbsent = Effect.fnUntraced(function* (path: string) {
		const present = yield* vault
			.exists(mdSplitPath(path))
			.pipe(Effect.orElseSucceed(() => true));
		if (present) return yield* new StaleRead({ path });
	});

	const roundTripError = (path: string, cause: unknown) =>
		new DictionaryRoundTripError({
			message:
				cause instanceof NoteSerializeError
					? `The note cannot hold these records: ${cause.message}`
					: message(cause),
			path,
		});

	type NoteWrite = {
		readonly path: string;
		readonly kind: "lemma" | "reading";
		/** The path the note sits at, or none for a note the commit creates. */
		readonly existing: boolean;
		/** Whether its records change, so any difference is written. */
		readonly changed: boolean;
		readonly owner: string;
		/** A Reading note's Reading key. */
		readonly readingKey?: string;
		readonly transform: (current: string) => string;
		/** Whether written content parses back to the records it was written from. */
		readonly parsesBack: (entry: PathEntry) => boolean;
	};

	/**
	 * Plans one note's write. A note whose records change is written when
	 * its content does; any other note only when its metadata does, which
	 * holds the renderings' seals, so a note the user rearranged is not
	 * rewritten for that alone.
	 */
	const planNote = Effect.fnUntraced(function* (
		view: NoteIndex,
		note: NoteWrite,
		skip: ReadonlySet<string>,
	): Effect.fn.Return<
		PlannedWrite[],
		StaleRead | DictionaryPathOccupiedError | DictionaryRoundTripError
	> {
		const unchanged = (current: string, next: string) =>
			note.kind === "lemma"
				? sameMetadata(current, next, LemmaNoteMetadata)
				: sameMetadata(current, next, ReadingNoteMetadata);
		const produce = (path: string, current: string) =>
			Effect.try({
				catch: (cause) => roundTripError(path, cause),
				try: () => {
					const next = note.transform(current);
					if (!note.parsesBack(classifyFile(path, next)))
						throw new Error(
							"The written note does not parse back to its records",
						);
					return next;
				},
			});
		const rewrite = Effect.fnUntraced(function* (path: string) {
			const current = yield* readCurrent(view, path);
			const next = yield* produce(path, current);
			const write = note.changed
				? next !== current
				: !unchanged(current, next);
			if (!write) return [];
			return [
				{
					action: compareAndSwap(path, current, next),
					content: next,
					path,
					phase: note.changed ? Phase.Own : Phase.FanOut,
				} satisfies PlannedWrite,
			];
		});
		if (skip.has(note.path)) return [];
		if (note.existing) return yield* rewrite(note.path);

		// A case or Unicode variant of the path is the same file on macOS.
		const [occupiedAt] = view.sameFileAs(note.path);
		if (occupiedAt !== undefined) {
			const occupant = view.entry(occupiedAt);
			// A Reading note left without its Lemma note holds this very
			// Reading: it is written again, keeping its text.
			if (
				occupant?.kind === "reading" &&
				note.kind === "reading" &&
				occupant.readingKey === note.readingKey &&
				occupant.path === note.path &&
				occupant.lemmaKey !== undefined &&
				view.lemmaNote(occupant.lemmaKey) === undefined
			)
				return yield* rewrite(occupiedAt);
			return yield* new DictionaryPathOccupiedError({
				message: `${note.path} would collide with ${occupiedAt}, which holds ${occupant?.kind === "lemma" || occupant?.kind === "reading" ? `a ${occupant.kind} note of another identity` : `a ${occupant?.kind ?? "file"} note`}; the store will not overwrite it`,
				path: note.path,
			});
		}
		const collision = view.folderCollision(note.path);
		if (collision !== undefined)
			return yield* new DictionaryPathOccupiedError({
				message: `${note.path} would put a note in ${collision.folder}, which collides with the folder ${collision.existing}`,
				path: note.path,
			});
		yield* assertAbsent(note.path);
		const content = yield* produce(note.path, "");
		return [
			{
				action: createNote(note.path, content),
				content,
				owner: note.owner,
				path: note.path,
				phase: Phase.Create,
			},
		];
	});

	/**
	 * Plans the writes of one Lemma's notes toward `intended`, against the
	 * files `view` indexes. `render` re-renders a Lemma whose records stay.
	 * Text in a removed Reading note moves to its Lemma note; text in the
	 * notes of a removed Lemma moves to its spelling's Crossroad note.
	 */
	const planLemma = Effect.fnUntraced(function* (input: {
		readonly view: NoteIndex;
		readonly lemmaKey: string;
		readonly intended: NoteData | undefined;
		readonly render: WriteOptions<"de">;
		readonly mode: "commit" | "render";
		readonly skip: ReadonlySet<string>;
		/** Text a Crossroad note takes, by form key. */
		readonly toCrossroad: Map<string, string[]>;
	}): Effect.fn.Return<
		PlannedWrite[],
		| StaleRead
		| DictionaryPathOccupiedError
		| DictionaryRoundTripError
		| DictionaryRequestError
	> {
		const { view, lemmaKey, intended, render, mode, skip } = input;
		const held = view.lemmaNote(lemmaKey);
		const writes: PlannedWrite[] = [];
		/**
		 * Sends a note to the trash only while it holds what was read: VAM
		 * checks it next to the trash, so text typed into it meanwhile is
		 * moved, not lost.
		 */
		const trash = (
			path: string,
			phase: Phase,
			expected: string,
		): PlannedWrite => ({
			action: {
				kind: VaultActionKind.TrashMdFile,
				payload: { ifContent: expected, splitPath: mdSplitPath(path) },
			},
			content: undefined,
			path,
			phase,
		});
		// Every note of the Lemma, duplicates included, so a removal never
		// leaves a copy to take its place.
		const notes = view.notesOf(lemmaKey);

		if (intended === undefined) {
			if (!held) return writes;
			const texts: string[] = [];
			const readings = [...notes.readings.values()].flat();
			for (const path of notes.lemma) {
				const current = yield* readCurrent(view, path);
				texts.push(...freeformOfNote(current, "lemma"));
				writes.push(trash(path, Phase.TrashLemmas, current));
			}
			for (const path of readings) {
				const current = yield* readCurrent(view, path);
				texts.push(...freeformOfNote(current, "reading"));
				writes.push(trash(path, Phase.TrashReadings, current));
			}
			if (texts.length > 0) {
				const key = formKeyOf(
					held.data.lemmaRecord.lemma.canonicalForm,
					"de",
				);
				input.toCrossroad.set(key, [
					...(input.toCrossroad.get(key) ?? []),
					...texts,
				]);
			}
			return writes.map((write) => ({ ...write, lemmaKey }));
		}
		if (mode === "render" && !held) return writes;

		const records = canonicalData(intended);
		const { lemma } = records.lemmaRecord;
		const noPath = (what: string) =>
			new DictionaryRequestError({
				cause: lemma,
				message: `The ${what} has no note path the path module can spell`,
			});

		const rescued: string[] = [];
		for (const readingKey of held?.readingPaths.keys() ?? []) {
			if (readingRecords(records, readingKey).entry) continue;
			for (const path of notes.readings.get(readingKey) ?? []) {
				const current = yield* readCurrent(view, path);
				rescued.push(...freeformOfNote(current, "reading"));
				writes.push(trash(path, Phase.TrashReadings, current));
			}
		}

		const lemmaPath = held?.path ?? canonicalLemmaPath(lemma);
		if (lemmaPath === undefined) return yield* noPath("Lemma");
		writes.push(
			...(yield* planNote(
				view,
				{
					changed:
						held === undefined ||
						rescued.length > 0 ||
						!sameJson(held.data.lemmaRecord, records.lemmaRecord) ||
						!sameSet(
							held.data.ownedSurfaceEntries,
							records.ownedSurfaceEntries,
						),
					existing: held !== undefined,
					kind: "lemma",
					owner: lemmaNoteOwner(lemma),
					parsesBack: (entry) =>
						entry.kind === "lemma" &&
						entry.lemmaKey === lemmaKey &&
						sameJson(entry.data.lemmaRecord, records.lemmaRecord) &&
						sameSet(
							entry.data.ownedSurfaceEntries,
							records.ownedSurfaceEntries,
						),
					path: lemmaPath,
					transform: writeLemmaNote(records, {
						...render,
						extraFreeform: rescued,
					}),
				},
				skip,
			)),
		);

		for (const { reading } of records.readingEntries) {
			const readingKey = readingKeyOf(reading);
			const path =
				held?.readingPaths.get(readingKey) ??
				canonicalReadingPath(reading);
			if (path === undefined) return yield* noPath("Reading");
			const wanted = readingRecords(records, readingKey);
			const was = held && readingRecords(held.data, readingKey);
			writes.push(
				...(yield* planNote(
					view,
					{
						changed:
							was?.entry === undefined ||
							!sameJson(was.entry, wanted.entry) ||
							!sameSet(was.pending, wanted.pending),
						existing: held?.readingPaths.has(readingKey) ?? false,
						kind: "reading",
						owner: readingNoteOwner(reading),
						parsesBack: (entry) =>
							entry.kind === "reading" &&
							entry.readingKey === readingKey &&
							sameJson(entry.data.readingEntry, wanted.entry) &&
							sameSet(
								entry.data.pendingRelations,
								wanted.pending,
							),
						path,
						readingKey,
						transform: writeReadingNote(records, reading, render),
					},
					skip,
				)),
			);
		}
		return writes.map((write) => ({ ...write, lemmaKey }));
	});

	/**
	 * Plans the write of a spelling's Crossroad note against `view`, from the
	 * index `after` the change. A missing one is created only when it has
	 * something to list or keep. A file there that is not a Crossroad note is
	 * left alone; text that should have moved there stops the commit.
	 */
	const planCrossroad = Effect.fnUntraced(function* (input: {
		readonly view: NoteIndex;
		readonly after: NoteIndex;
		readonly key: string;
		readonly extra: readonly string[];
		readonly skip: ReadonlySet<string>;
	}): Effect.fn.Return<
		PlannedWrite[],
		StaleRead | DictionaryPathOccupiedError
	> {
		const { view, after, key, extra, skip } = input;
		const path = crossroadPathOf(key);
		if (path === undefined || skip.has(path)) return [];
		const content = crossroadContentOf(after, key);
		const write = writeCrossroadNote(content, metadataFormat(), extra);
		const refuse = (reason: string) =>
			extra.length > 0
				? Effect.fail(
						new DictionaryPathOccupiedError({
							message: `${path} ${reason}, so the text of the removed notes has nowhere to go`,
							path,
						}),
					)
				: Effect.logWarning(
						`Dictionary left the Crossroad note ${path} alone: it ${reason}`,
					).pipe(Effect.as([] as PlannedWrite[]));
		const [occupiedAt] = view.sameFileAs(path);
		if (occupiedAt === undefined) {
			if (
				content.lemmas.length === 0 &&
				content.surfaces.length === 0 &&
				extra.length === 0
			)
				return [];
			const collision = view.folderCollision(path);
			if (collision !== undefined)
				return yield* refuse(
					`would sit in ${collision.folder}, which collides with ${collision.existing}`,
				);
			yield* assertAbsent(path);
			const created = write("");
			return [
				{
					action: createNote(path, created),
					content: created,
					formKey: key,
					path,
					// Text moved from removed notes must land before they go.
					phase: extra.length > 0 ? Phase.Own : Phase.FanOut,
				},
			];
		}
		const occupant = view.entry(occupiedAt);
		if (occupant?.kind !== "crossroad" || occupiedAt !== path)
			return yield* refuse(`holds a ${occupant?.kind ?? "file"} note`);
		// Names are lossy: another spelling's Crossroad note keeps its path.
		if (occupant.key !== undefined && occupant.key !== key)
			return yield* refuse(
				`holds the Crossroad note of another spelling, ${JSON.stringify(occupant.key)}`,
			);
		const current = yield* readCurrent(view, path);
		const next = write(current);
		const changed =
			extra.length > 0 || crossroadMetadataOf(current) === undefined
				? next !== current
				: !sameMetadata(current, next, CrossroadNoteMetadata);
		if (!changed) return [];
		return [
			{
				action: compareAndSwap(path, current, next),
				content: next,
				formKey: key,
				path,
				// Text moved from removed notes must land before they go.
				phase: extra.length > 0 ? Phase.Own : Phase.FanOut,
			},
		];
	});

	/**
	 * Merges a displaced note into its spelling's Crossroad note, which is
	 * already there: its user text goes below the Crossroad's rendering,
	 * then the note goes to the trash, only while it still holds what was
	 * read. A merge lands as a whole (#201): when the trash is refused, the
	 * note changed after it was read, so its copy, while the Crossroad note
	 * still holds it as the store wrote it, is replaced by the note's text
	 * as it now reads, and the trash is tried again. After
	 * `MERGE_ATTEMPTS` refusals the copy is taken back and the note waits
	 * for the next merge, so an edited paragraph never stands in the
	 * Crossroad note beside its earlier copy. A Crossroad note changed after
	 * the store wrote the copy keeps it, and the note's text is added again
	 * beside it: both versions stay. A note whose frontmatter holds
	 * properties stays, since the Crossroad note cannot take them. Answers
	 * whether it merged; a note that stays is added to `blocked`.
	 */
	const mergeDisplaced = Effect.fnUntraced(function* (
		displaced: DisplacedCrossroad,
		blocked: HealingBlocked[],
	): Effect.fn.Return<boolean> {
		const { from, to, key } = displaced;
		const block = (message: string) => {
			blocked.push({ canonicalPath: to, message, path: from });
			return false;
		};
		const reread = Effect.suspend(() => {
			cache?.delete(from);
			cache?.delete(to);
			return rereadChanges([from, to]);
		});
		/**
		 * The Crossroad note before this merge's copy, and with it, while the
		 * file is known to hold the copy as the store wrote it.
		 */
		let copy:
			| { readonly before: string; readonly after: string }
			| undefined;
		/** Takes the copy back, unless the Crossroad note changed since. */
		const takeBack = Effect.suspend(() => {
			if (copy === undefined || copy.after === copy.before)
				return Effect.void;
			return Effect.result(
				dispatch([compareAndSwap(to, copy.after, copy.before)]),
			).pipe(
				Effect.flatMap((undone) => {
					if (undone._tag === "Success") return Effect.void;
					const warning = `Dictionary could not take back what it copied from ${from} into ${to}; both keep the text`;
					// A conflict is the user's edit of the Crossroad note.
					return isContentConflict(undone.failure)
						? Effect.logWarning(warning)
						: Effect.logWarning(warning, undone.failure);
				}),
			);
		});
		for (let attempt = 0; attempt < MERGE_ATTEMPTS; attempt++) {
			if (attempt > 0) {
				yield* reread;
				// Gone meanwhile: what it held stays merged.
				if (index.entry(from) === undefined) return true;
			}
			const view = index;
			const read = yield* Effect.result(readCurrent(view, from));
			// A file ahead of the index: its event comes, and heals it then.
			if (read._tag === "Failure") {
				if (copy === undefined) return false;
				continue;
			}
			const current = read.success;
			const { properties, texts } = crossroadUserText(current);
			if (properties) {
				yield* takeBack;
				if (copy !== undefined) yield* reread;
				return block(
					"Its Crossroad note is already there, and it holds properties a Crossroad note cannot take; move them by hand",
				);
			}
			if (copy !== undefined) {
				// The copy as the note now reads, in place of the old one.
				const next = writeCrossroadNote(
					crossroadContentOf(view, key),
					metadataFormat(),
					texts,
				)(copy.before);
				const replaced =
					next === copy.after
						? undefined
						: yield* Effect.result(
								dispatch([
									compareAndSwap(to, copy.after, next),
								]),
							);
				if (replaced === undefined || replaced._tag === "Success")
					copy = { after: next, before: copy.before };
				else if (isContentConflict(replaced.failure)) {
					// The user edited the Crossroad note since: the copy stays
					// as they left it, and the note's text joins it again.
					yield* Effect.logWarning(
						`Dictionary keeps both versions of the text ${from} changed after it was copied into ${to}, which changed too`,
					);
					copy = undefined;
					continue;
				} else {
					yield* Effect.logWarning(
						`Dictionary could not merge ${from} into ${to}`,
						replaced.failure,
					);
					yield* reread;
					return false;
				}
			} else {
				const before = yield* Effect.result(readCurrent(view, to));
				if (before._tag === "Failure") return false;
				const planned = yield* Effect.result(
					planCrossroad({
						after: view,
						extra: texts,
						key,
						skip: new Set(),
						view,
					}),
				);
				if (planned._tag === "Failure")
					return planned.failure._tag === "StaleRead"
						? false
						: block(planned.failure.message);
				const writes = planned.success;
				if (writes.length > 0) {
					const wrote = yield* Effect.result(
						dispatch(writes.map(({ action }) => action)),
					);
					if (wrote._tag === "Failure") {
						yield* Effect.logWarning(
							`Dictionary could not merge ${from} into ${to}`,
							wrote.failure,
						);
						yield* rereadChanges([to]);
						return false;
					}
				}
				copy = {
					after: writes.at(-1)?.content ?? before.success,
					before: before.success,
				};
			}
			const trashed = yield* Effect.result(
				dispatch([
					{
						kind: VaultActionKind.TrashMdFile,
						payload: {
							ifContent: current,
							splitPath: mdSplitPath(from),
						},
					},
				]),
			);
			// Refused: the note changed after it was read. Merge it again.
			if (
				trashed._tag === "Failure" &&
				isContentConflict(trashed.failure)
			)
				continue;
			if (trashed._tag === "Failure")
				yield* Effect.logWarning(
					`Dictionary merged ${from} into ${to} but could not trash it`,
					trashed.failure,
				);
			yield* reread;
			return index.entry(from) === undefined;
		}
		// It kept changing: it waits, whole, for the next merge.
		yield* takeBack;
		yield* reread;
		return block(
			"It changed during each merge into its Crossroad note; it is merged once it stays unchanged",
		);
	});

	/**
	 * The index with each Lemma's intended records in place, for rendering
	 * only: it is never published. A note sits where the index holds it, or
	 * at its own path.
	 */
	const previewOf = (view: NoteIndex, intended: Intended): NoteIndex => {
		const preview = view.clone();
		for (const [lemmaKey, data] of intended) {
			const held = view.lemmaNote(lemmaKey);
			if (held)
				for (const path of [held.path, ...held.readingPaths.values()])
					preview.set(path, undefined);
			if (data === undefined) continue;
			const lemmaPath =
				held?.path ?? canonicalLemmaPath(data.lemmaRecord.lemma);
			if (lemmaPath === undefined) continue;
			preview.set(lemmaPath, {
				data: {
					lemmaRecord: data.lemmaRecord,
					ownedSurfaceEntries: data.ownedSurfaceEntries,
				},
				hash: "",
				kind: "lemma",
				lemmaKey,
				path: lemmaPath,
			});
			for (const entry of data.readingEntries) {
				const readingKey = readingKeyOf(entry.reading);
				const path =
					held?.readingPaths.get(readingKey) ??
					canonicalReadingPath(entry.reading);
				if (path === undefined) continue;
				preview.set(path, {
					data: {
						pendingRelations: readingRecords(data, readingKey)
							.pending,
						readingEntry: entry,
					},
					hash: "",
					kind: "reading",
					lemmaKey,
					path,
					readingKey,
				});
			}
		}
		return preview;
	};

	/**
	 * Plans a commit toward `intended` against the published index: the
	 * touched Lemmas' notes, the notes the change moves links in, and the
	 * Crossroads of every spelling it touches. Created paths are checked
	 * against each other and every indexed path for collisions.
	 */
	const planCommit = Effect.fnUntraced(function* (intended: Intended) {
		const view = index;
		const after = previewOf(view, intended);
		const { failed, options: render } = renderOptionsFor(
			after,
			projections,
			metadataFormat(),
		);
		const fan = fanOutOf(view, after, intended.keys());
		const toCrossroad = new Map<string, string[]>();
		const skip = new Set<string>();
		const writes: PlannedWrite[] = [];
		for (const [lemmaKey, data] of intended)
			writes.push(
				...(yield* planLemma({
					intended: data,
					lemmaKey,
					mode: "commit",
					render,
					skip,
					toCrossroad,
					view,
				})),
			);
		// Other notes only show what the change moves. One whose file is
		// ahead of the index is left out of the commit and re-rendered once
		// it has been read again.
		const deferred: Deferred = {
			formKeys: new Set(),
			lemmaKeys: new Set(),
			paths: new Set(),
		};
		for (const lemmaKey of fan.lemmas) {
			const planned = yield* Effect.result(
				planLemma({
					intended: after.lemmaData(lemmaKey),
					lemmaKey,
					mode: "render",
					render,
					skip,
					toCrossroad,
					view,
				}),
			);
			if (planned._tag === "Success") writes.push(...planned.success);
			else if (planned.failure._tag === "StaleRead") {
				deferred.paths.add(planned.failure.path);
				deferred.lemmaKeys.add(lemmaKey);
			}
			// A neighbour that cannot be re-rendered keeps its renderings;
			// it never holds up the change.
			else
				yield* Effect.logWarning(
					"Dictionary could not re-render a note the commit moves links in",
					planned.failure,
				);
		}
		for (const key of new Set([...fan.formKeys, ...toCrossroad.keys()])) {
			const extra = toCrossroad.get(key) ?? [];
			const planned = yield* Effect.result(
				planCrossroad({ after, extra, key, skip, view }),
			);
			if (planned._tag === "Success") writes.push(...planned.success);
			else if (extra.length > 0) return yield* planned.failure;
			else if (planned.failure._tag === "StaleRead") {
				deferred.paths.add(planned.failure.path);
				deferred.formKeys.add(key);
			} else
				yield* Effect.logWarning(
					"Dictionary could not re-render a Crossroad note",
					planned.failure,
				);
		}
		if (failed.size > 0)
			yield* Effect.logWarning(
				"Dictionary could not project inverse relations for some notes it writes",
				[...failed],
			);
		const claims: PathClaim[] = writes.flatMap(({ owner, path }) =>
			owner === undefined ? [] : [{ owner, path }],
		);
		const [collision] = findPathCollisions(claims);
		if (collision)
			return yield* new DictionaryPathOccupiedError({
				message: `${collision.second.path} and ${collision.first.path} are one ${collision.component} on a case-insensitive file system; the store writes neither over the other`,
				path: collision.second.path,
			});
		return { deferred, writes };
	});

	type Executed =
		| {
				readonly _tag: "Done";
				/** Writes that landed. */
				readonly landed: readonly PlannedWrite[];
				/** Re-renders of other notes that did not land. */
				readonly missed: readonly PlannedWrite[];
		  }
		| {
				readonly _tag: "Failed";
				readonly phase: Phase;
				/** Writes that landed, in this and earlier batches. */
				readonly landed: readonly PlannedWrite[];
				readonly skipped: readonly PlannedWrite[];
				readonly cause: unknown;
				/** The write that stopped found its file changed by someone else. */
				readonly externalChange: boolean;
				/** VAM failed the write that stopped as `io`. */
				readonly transient: boolean;
				/** What VAM took back of a stopped create phase. */
				readonly undo?: VamUndoReport;
		  };

	/**
	 * Dispatches a plan's writes phase by phase, stopping at the first
	 * failure, except among the re-renders of other notes: they change no
	 * record, so the ones that fail are only reported back.
	 */
	const execute = Effect.fnUntraced(function* (
		writes: readonly PlannedWrite[],
	): Effect.fn.Return<Executed> {
		const landed: PlannedWrite[] = [];
		const missed: PlannedWrite[] = [];
		for (const phase of PHASES) {
			const batch = writes.filter((write) => write.phase === phase);
			if (batch.length === 0) continue;
			const actions = batch.map(({ action }) => action);
			const outcome = yield* Effect.result(
				phase === Phase.Create
					? dispatchOrUndo(actions)
					: dispatch(actions),
			);
			if (outcome._tag === "Success") {
				landed.push(...batch);
				continue;
			}
			const failure = outcome.failure;
			const executed = new Set(
				failure.report.executed.map(vaultActionTargetPath),
			);
			if (phase === Phase.FanOut) {
				const ran = (write: PlannedWrite) => executed.has(write.path);
				landed.push(...batch.filter(ran));
				missed.push(...batch.filter((write) => !ran(write)));
				yield* Effect.logWarning(
					"Dictionary re-renders of other notes stopped; they are read again after the commit",
					failure,
				);
				continue;
			}
			const later = writes.filter((write) => write.phase > phase);
			const { reason } = failure;
			return {
				_tag: "Failed",
				cause:
					reason._tag === "VamDispatchError" ? reason.cause : failure,
				externalChange:
					reason._tag === "VamDispatchError" &&
					EXTERNAL_CHANGE_KINDS.has(reason.kind),
				landed: [
					...landed,
					...batch.filter(({ path }) => executed.has(path)),
				],
				phase,
				skipped: [
					...batch.filter(({ path }) => !executed.has(path)),
					...later,
				],
				transient:
					reason._tag === "VamDispatchError" && reason.kind === "io",
				...(failure.report.undo ? { undo: failure.report.undo } : {}),
			};
		}
		return { _tag: "Done", landed, missed };
	});

	/** Publishes the files a plan wrote, as their contents read. */
	const applied = (
		writes: readonly PlannedWrite[],
		publishAs: (next: NoteIndex) => void,
	) => {
		const next = index.clone();
		for (const { content, path } of writes) {
			if (content !== undefined && index.entry(path) === undefined)
				appeared.add(basenameKeyOf(path));
			next.set(
				path,
				content === undefined ? undefined : classifyFile(path, content),
			);
			cache?.delete(path);
		}
		publishAs(next);
	};

	/**
	 * Re-renders these Lemmas' notes and these spellings' Crossroads from the
	 * published index, under the writer lock its caller holds, writing only
	 * what changed, as compare-and-swaps on the content the store indexed. A
	 * note whose file is ahead of the index, or whose write loses a race, is
	 * re-read and tried again, for at most three rounds. Re-renders keep the
	 * revision. It never fails: a note it cannot re-render keeps its
	 * renderings until the next one.
	 */
	const rerender = Effect.fnUntraced(function* (
		lemmaKeys: ReadonlySet<string>,
		formKeys: ReadonlySet<string>,
		skip: ReadonlySet<string> = new Set(),
		/**
		 * Writes each round's Lemma notes only once its other writes landed,
		 * so a Lemma note that records the current table versions never
		 * stands beside a Reading note whose embed is still stale.
		 */
		lemmaNotesLast = false,
	) {
		const landed = new Set<string>();
		let pendingLemmas = [...lemmaKeys].sort(byCodeUnit);
		let pendingForms = [...formKeys].sort(byCodeUnit);
		for (
			let round = 0;
			round < 3 && pendingLemmas.length + pendingForms.length > 0;
			round += 1
		) {
			const view = index;
			const { failed, options: render } = renderOptionsFor(
				view,
				projections,
				metadataFormat(),
			);
			const writes: PlannedWrite[] = [];
			const stalePaths: string[] = [];
			const retryLemmas = new Set<string>();
			const retryForms = new Set<string>();
			for (const lemmaKey of pendingLemmas) {
				if (failed.has(lemmaKey)) continue;
				const planned = yield* Effect.result(
					planLemma({
						intended: view.lemmaData(lemmaKey),
						lemmaKey,
						mode: "render",
						render,
						skip,
						toCrossroad: new Map(),
						view,
					}),
				);
				if (planned._tag === "Success") writes.push(...planned.success);
				else if (planned.failure._tag === "StaleRead") {
					stalePaths.push(planned.failure.path);
					retryLemmas.add(lemmaKey);
				} else
					yield* Effect.logWarning(
						"Dictionary could not re-render a note",
						planned.failure,
					);
			}
			for (const key of pendingForms) {
				const planned = yield* Effect.result(
					planCrossroad({ after: view, extra: [], key, skip, view }),
				);
				if (planned._tag === "Success") writes.push(...planned.success);
				else if (planned.failure._tag === "StaleRead") {
					stalePaths.push(planned.failure.path);
					retryForms.add(key);
				}
			}
			if (failed.size > 0)
				yield* Effect.logWarning(
					"Dictionary could not project a note's inverse relations",
					[...failed],
				);
			if (stalePaths.length > 0) yield* rereadChanges(stalePaths);
			const isLemmaNote = ({ lemmaKey, path }: PlannedWrite) =>
				lemmaKey !== undefined &&
				view.lemmaNote(lemmaKey)?.path === path;
			const batches = lemmaNotesLast
				? [
						writes.filter((write) => !isLemmaNote(write)),
						writes.filter(isLemmaNote),
					]
				: [writes];
			for (const batch of batches) {
				if (batch.length === 0) continue;
				const outcome = yield* Effect.result(
					dispatch(batch.map(({ action }) => action)),
				);
				if (outcome._tag === "Success") {
					applied(batch, publishRendering);
					for (const { path } of batch) landed.add(path);
					continue;
				}
				for (const action of outcome.failure.report.executed)
					landed.add(vaultActionTargetPath(action));
				yield* Effect.logWarning(
					"Dictionary re-renders stopped; re-reading the notes",
					outcome.failure,
				);
				yield* rereadChanges(batch.map(({ path }) => path));
				for (const key of pendingLemmas) retryLemmas.add(key);
				for (const key of pendingForms) retryForms.add(key);
				break;
			}
			pendingLemmas = [...retryLemmas].sort(byCodeUnit);
			pendingForms = [...retryForms].sort(byCodeUnit);
		}
		return landed;
	});

	/**
	 * Writes the Crossroad notes that are missing or stale against the
	 * published index (`staleCrossroads`): of every spelling, or only of
	 * the Crossroad notes among `paths`, such as the empty note a click on
	 * an uncreated Crossroad link leaves, filled as "not classified yet".
	 * A missing note is created only when its spelling has something to
	 * list, and never over a file that sits on its path or its folders,
	 * nor beside another created note it collides with. It writes nothing
	 * when every Crossroad note is current, and never fails.
	 */
	const regenerateCrossroads = Effect.fnUntraced(function* (
		paths?: Iterable<string>,
	) {
		const view = index;
		const stale = staleCrossroads(view, paths);
		if (stale.length === 0) return;
		const creates: PathClaim[] = stale.flatMap((key) => {
			const path = crossroadPathOf(key);
			return path === undefined || view.sameFileAs(path).length > 0
				? []
				: [{ owner: key, path }];
		});
		const collisions = findPathCollisions(creates);
		if (collisions.length > 0)
			yield* Effect.logWarning(
				"Dictionary left out Crossroad notes whose paths collide with each other",
				collisions.map(
					({ first, second }) =>
						`${second.path} (${second.owner}) and ${first.path} (${first.owner})`,
				),
			);
		const dropped = new Set(collisions.map(({ second }) => second.owner));
		yield* rerender(
			new Set(),
			new Set(stale.filter((key) => !dropped.has(key))),
		);
	});

	/**
	 * The Lemmas stored claims name but the index does not read as data;
	 * `converge` keeps only those no file holds, so a note that is there but
	 * unreadable, such as one being edited by hand, keeps its claims.
	 */
	const danglingTargets = (view: NoteIndex): Dumling.Lemma<"de">[] =>
		view.claimedLemmaKeys().flatMap((key) => {
			if (view.lemmaData(key)) return [];
			const [edge] = view.edgesTo(key);
			if (!edge) return [];
			return [
				edge.target.kind === "lemma"
					? edge.target.lemma
					: edge.target.reading.lemma,
			];
		});

	/**
	 * Plans one re-evaluation from a slice loaded now and commits it as a
	 * commit of its own. It never fails: what goes wrong is logged.
	 */
	const reevaluate = <S>(
		load: () => S,
		plan: (slice: S) => DumdictPlanOutcome<"de">,
		depth: number,
	): Effect.Effect<void> =>
		Effect.gen(function* () {
			const slice = Result.try(load);
			if (Result.isFailure(slice)) {
				yield* Effect.logWarning(
					"Dictionary could not load a Shadow re-evaluation slice",
				);
				return;
			}
			const attempt = planned(() => plan(slice.success));
			if (Result.isFailure(attempt)) {
				yield* Effect.logWarning(
					"Dictionary could not plan a Shadow re-evaluation",
					attempt.failure,
				);
				return;
			}
			const outcome = attempt.success;
			if (outcome.status !== "planned") {
				yield* Effect.logWarning(
					"Dictionary could not re-evaluate Shadows",
					outcome,
				);
				return;
			}
			if (outcome.plan.changes.length === 0) return;
			const result = yield* Effect.result(
				commitUnderLock(outcome.plan, depth + 1),
			);
			if (
				result._tag === "Failure" ||
				result.success.status !== "committed"
			)
				yield* Effect.logWarning(
					"Dictionary Shadow re-evaluation did not commit",
					result._tag === "Failure" ? result.failure : result.success,
				);
		});

	/**
	 * Moves the claims on Lemmas the files no longer hold and re-evaluates
	 * the Shadows they leave (`reevaluateShadows`), and retries every stored
	 * Shadow relation whose resolution the Lemmas no longer fit
	 * (`cleanupRelations`, which re-evaluates the records it names), as
	 * commits of their own, from slices loaded now. It is what makes links
	 * converge after a removal, a hand edit or a failed commit. `scope`
	 * narrows it to the Shadows of Lemmas a change added or removed;
	 * `removed` names Lemmas removed by a plan. It never fails.
	 */
	const converge = (
		scope: {
			readonly shadowKeys?: ReadonlySet<string>;
			readonly removed?: readonly Dumling.Lemma<"de">[];
		} = {},
		depth = 0,
	): Effect.Effect<void> =>
		Effect.gen(function* () {
			if (depth > MAX_FOLLOW_UP_DEPTH) return;
			const view = index;
			// A Lemma only counts as removed while no file holds it, and not at
			// all after a scan that could not read every folder.
			const removed = new Map<string, Dumling.Lemma<"de">>();
			if (scanIssues.length === 0)
				for (const lemma of [
					...(scope.removed ?? []),
					...danglingTargets(view),
				])
					if (
						!view.lemmaData(lemmaKeyOf(lemma)) &&
						!view.holdsAnyNoteOf(lemma)
					)
						removed.set(lemmaKeyOf(lemma), lemma);
			if (removed.size > 0) {
				const request = { removedLemmas: [...removed.values()] };
				yield* reevaluate(
					() =>
						loadReevaluateShadowsContext(
							index,
							revision(),
							request,
						),
					(slice) =>
						planner.reevaluateShadows(slice, {
							...request,
							baseRevision: slice.revision,
						}),
					depth,
				);
			}
			// The removal's commit settled the Shadows of the Lemmas it
			// removed; the rest are read from the index it left.
			const locators: PendingSemanticRelationRecord<"de">["locator"][] =
				[];
			for (const record of index.allPending()) {
				if (
					scope.shadowKeys !== undefined &&
					!scope.shadowKeys.has(pendingShadowKeyOf(record))
				)
					continue;
				if (unsettled(index, record)) locators.push(record.locator);
			}
			for (let at = 0; at < locators.length; at += REEVALUATION_CHUNK) {
				const request = {
					resolutions: locators
						.slice(at, at + REEVALUATION_CHUNK)
						.map((locator) => ({ locator })),
				};
				yield* reevaluate(
					() =>
						loadCleanupRelationsContext(index, revision(), request),
					(slice) =>
						planner.cleanupRelations(slice, {
							...request,
							baseRevision: slice.revision,
						}),
					depth,
				);
			}
		}).pipe(
			Effect.catchCause((cause) =>
				Effect.logError(
					"Dictionary Shadow re-evaluation failed",
					cause,
				),
			),
		);

	/**
	 * Adopts the names Obsidian's link updater gave refs in Deine Kontexte
	 * while the store was not listening (#99), as one commit under the lock
	 * its caller holds: each ref whose stored name opens no note now and
	 * whose shown name opens a Scroll. It never fails.
	 */
	const repairRetargetedRefs = Effect.gen(function* () {
		const retargeted = index.allEntries().flatMap((entry) =>
			entry.kind === "reading"
				? (entry.retargeted ?? []).map((shown) => ({
						...shown,
						from: entry.path,
					}))
				: [],
		);
		if (retargeted.length === 0) return;
		const retarget = yield* retargetForRepairs(retargeted, lookup);
		if (retarget === undefined) return;
		const step = planRefRewrite(viewOf(index, revision()), retarget);
		if (step._tag !== "Commit") return;
		const result = yield* Effect.result(commitUnderLock(step.plan));
		if (result._tag === "Failure" || result.success.status !== "committed")
			yield* Effect.logWarning(
				"Dictionary could not adopt the names Obsidian gave refs into moved Scrolls",
				result._tag === "Failure" ? result.failure : result.success,
			);
		else
			yield* Effect.logInfo(
				`Dictionary renamed ${step.value.rewritten} refs into Scrolls moved while it was not running`,
			);
	}).pipe(
		Effect.catchCause((cause) =>
			Effect.logError(
				"Dictionary could not repair refs into moved Scrolls",
				cause,
			),
		),
	);

	/**
	 * Moves the refs a dictionary note took their Scroll's basename from to
	 * the Scroll's path (#210, `retargetForShadows`), as one commit under
	 * the lock its caller holds: every ref after a full read, else the refs
	 * naming a note that appeared since the last check. It never fails.
	 */
	const repairShadowedRefs = (whole: boolean, depth = 0) =>
		Effect.gen(function* () {
			const names = appeared;
			appeared = new Set();
			if (!whole && names.size === 0) return;
			const held = heldRefs();
			if (held.length === 0) return;
			const retarget = yield* retargetForShadows(
				held,
				lookup,
				(path) =>
					vault.readContentWithStat(mdSplitPath(path)).pipe(
						Effect.map(({ content }) => content),
						Effect.orElseSucceed(() => undefined),
					),
				whole ? undefined : names,
			);
			if (retarget === undefined) return;
			const step = planRefRewrite(viewOf(index, revision()), retarget);
			if (step._tag !== "Commit") return;
			const result = yield* Effect.result(
				commitUnderLock(step.plan, depth + 1),
			);
			if (
				result._tag === "Failure" ||
				result.success.status !== "committed"
			)
				yield* Effect.logWarning(
					"Dictionary could not name Scrolls by path in refs a dictionary note shadowed",
					result._tag === "Failure" ? result.failure : result.success,
				);
			else
				yield* Effect.logInfo(
					`Dictionary named ${step.value.rewritten} Scrolls by path in refs a dictionary note shadowed`,
				);
		}).pipe(
			Effect.catchCause((cause) =>
				Effect.logError(
					"Dictionary could not repair refs a dictionary note shadowed",
					cause,
				),
			),
		);

	/**
	 * After a full read of `Worter/`: heal, let links converge, regenerate
	 * the Crossroad notes that are missing or stale, adopt the names
	 * Obsidian gave refs into Scrolls that moved meanwhile, then name by
	 * path the Scrolls of refs a dictionary note shadows.
	 */
	const settle = heal().pipe(
		Effect.andThen(Effect.suspend(() => converge())),
		Effect.andThen(regenerateCrossroads()),
		Effect.andThen(repairRetargetedRefs),
		Effect.andThen(Effect.suspend(() => repairShadowedRefs(true))),
	);

	/**
	 * After a commit or an observed change: re-render the notes the changed
	 * Lemmas move links in, then re-evaluate Shadows if Lemmas came or went.
	 * The changed files themselves are left to their editor.
	 */
	const followUp = Effect.fnUntraced(function* (
		before: NoteIndex,
		touched: ReadonlySet<string>,
		changedPaths: ReadonlySet<string>,
	) {
		const fan = fanOutOf(before, index, touched);
		const own = [...touched].filter((key) => index.lemmaData(key));
		yield* rerender(
			new Set([...fan.lemmas, ...own]),
			fan.formKeys,
			changedPaths,
		);
		const removed: Dumling.Lemma<"de">[] = [];
		const shadowKeys = new Set<string>();
		for (const key of touched) {
			const was = before.lemmaData(key)?.lemmaRecord.lemma;
			const is = index.lemmaData(key)?.lemmaRecord.lemma;
			if (Boolean(was) === Boolean(is)) continue;
			const lemma = (is ?? was) as Dumling.Lemma<"de">;
			shadowKeys.add(shadowKeyOf(lemma));
			if (was && !is) removed.push(was);
		}
		if (shadowKeys.size > 0) yield* converge({ removed, shadowKeys });
	});

	/**
	 * Re-reads what an event touched. Identity comes from content, never
	 * event order, so paths and folders are simply read again.
	 */
	const refresh = Effect.fnUntraced(function* (
		paths: Iterable<string>,
		folders: readonly string[] = [],
	) {
		const targets = new Set<string>();
		for (const path of paths) if (inScope(path)) targets.add(path);
		for (const folder of folders) {
			for (const path of index.paths())
				if (isUnder(path, folder)) targets.add(path);
			if (!isUnder(folder, WORTER_SPLIT_PATH.basename)) continue;
			const splitPath = folderSplitPath(folder);
			const present = yield* vault
				.exists(splitPath)
				.pipe(Effect.orElseSucceed(() => true));
			if (!present) continue;
			const scan = yield* Effect.result(vault.scanWithStat(splitPath));
			if (scan._tag === "Failure") {
				yield* Effect.logWarning(
					"Dictionary could not scan a folder; the index is stale",
					scan.failure,
				);
				stale = true;
				continue;
			}
			for (const entry of scan.success.entries)
				if (entry.kind === "MdFile") targets.add(formatPath(entry));
		}
		const before = index;
		const changes = yield* rereadChanges(targets);
		if (changes.length === 0) return false;
		const healed = yield* heal();
		// Only Lemmas whose records changed move links in other notes; text
		// typed into a note changes none.
		const touched = new Set<string>();
		for (const { before: was, entry } of changes)
			for (const note of [was, entry])
				if (
					(note?.kind === "lemma" || note?.kind === "reading") &&
					!sameJson(
						before.lemmaData(note.lemmaKey) ?? null,
						index.lemmaData(note.lemmaKey) ?? null,
					)
				)
					touched.add(note.lemmaKey);
		const changedPaths = new Set(changes.map(({ path }) => path));
		yield* followUp(before, touched, changedPaths);
		// A Crossroad note that appeared or changed without being current,
		// such as the empty note a click leaves or a stray healing moved, is
		// filled even though it was the file that changed.
		yield* regenerateCrossroads([...changedPaths, ...healed]);
		return true;
	});

	/** Event work: serialized with commits; a failure leaves the index stale. */
	const guarded = <E>(label: string, effect: Effect.Effect<unknown, E>) =>
		lock
			.withPermit(
				Effect.gen(function* () {
					if (stale && (yield* recover)) yield* settle;
					yield* effect;
					yield* repairShadowedRefs(false);
				}).pipe(
					Effect.onError(() => markStale),
					Effect.ensuring(report),
				),
			)
			.pipe(
				Effect.catchCause((cause) =>
					Effect.logError(`Dictionary ${label} failed`, cause),
				),
			);

	/** What one hold of the lock in `transact` ended with. */
	type Attempted<A> =
		| { readonly _tag: "Done"; readonly value: A }
		| {
				readonly _tag: "Conflict";
				readonly reason: string;
				readonly cause: unknown;
				/** A write failed as `io`: pause before planning again. */
				readonly transient?: true;
		  };

	/**
	 * Plans and commits until a plan stops or commits, a commit meets a
	 * change made outside the store, or the attempts run out, under one
	 * hold of the lock its caller takes. Nothing else moves the revision
	 * while the lock is held, so only an external change re-plans.
	 */
	const attemptUnderLock = <A, E>(
		plan: (view: DictionaryView) => Result.Result<Transaction<A>, E>,
		attempts: { used: number; readonly max: number; transient: boolean },
	): Effect.Effect<Attempted<A>, E | DictionaryCommitError> =>
		Effect.gen(function* () {
			for (;;) {
				attempts.used += 1;
				if (stale) {
					yield* rebuild();
					yield* settle;
				}
				// A plan that throws, as dumdict's planner does on a slice
				// that breaks its contract, fails typed instead of as a defect.
				const attempt: Result.Result<
					Transaction<A>,
					E | DictionaryPlanError
				> = Result.flatMap(
					Result.try({
						catch: (cause) =>
							new DictionaryPlanError({
								cause,
								message: `The dictionary could not plan: ${cause instanceof Error ? cause.message : String(cause)}`,
							}),
						try: () => plan(viewOf(index, revision())),
					}),
					(result) => result,
				);
				if (Result.isFailure(attempt))
					return yield* Effect.fail(attempt.failure);
				const step = attempt.success;
				if (step._tag === "Stop")
					return { _tag: "Done", value: step.value } as const;
				if (step._tag === "Replan")
					return {
						_tag: "Conflict",
						cause: step.reason,
						reason: step.reason,
					} as const;
				const committed = yield* Effect.result(
					commitUnderLock(step.plan),
				);
				if (committed._tag === "Failure") {
					const error = committed.failure;
					if (
						error._tag === "DictionaryWriteError" &&
						error.externalChange
					)
						return {
							_tag: "Conflict",
							cause: error,
							reason: error.message,
						} as const;
					// An I/O failure, such as a file another process held,
					// may not recur: plan once more, after a pause.
					if (
						error._tag === "DictionaryWriteError" &&
						error.transient &&
						!attempts.transient &&
						attempts.used < attempts.max
					) {
						attempts.transient = true;
						return {
							_tag: "Conflict",
							cause: error,
							reason: error.message,
							transient: true,
						} as const;
					}
					return yield* Effect.fail(error);
				}
				const result = committed.success;
				if (result.status === "conflict")
					return {
						_tag: "Conflict",
						cause: result,
						reason: result.message ?? result.code,
					} as const;
				if (step._tag === "Commit")
					return { _tag: "Done", value: step.value } as const;
				if (attempts.used >= attempts.max)
					return {
						_tag: "Conflict",
						cause: step.reason,
						reason: step.reason,
					} as const;
			}
		});

	const transact = Effect.fn("dictionary.transact")(function* <A, E>(
		plan: (view: DictionaryView) => Result.Result<Transaction<A>, E>,
		options?: TransactOptions,
	): Effect.fn.Return<
		A,
		E | DictionaryCommitError | DictionaryTransactionConflict
	> {
		const max = Math.max(
			1,
			options?.maxAttempts ?? DEFAULT_TRANSACT_ATTEMPTS,
		);
		const attempts = { max, transient: false, used: 0 };
		for (;;) {
			const attempted = yield* lock.withPermit(
				attemptUnderLock(plan, attempts).pipe(Effect.ensuring(report)),
			);
			if (attempted._tag === "Done") return attempted.value;
			if (attempts.used >= max)
				return yield* new DictionaryTransactionConflict({
					attempts: attempts.used,
					cause: attempted.cause,
					message: `The dictionary kept changing outside the store over ${attempts.used} plans: ${attempted.reason}`,
					reason: attempted.reason,
				});
			// Released: let the events behind the change land before planning again.
			if (attempted.transient) yield* Effect.sleep(TRANSIENT_RETRY_DELAY);
			else yield* Effect.yieldNow;
		}
	});

	/** How Obsidian resolves names, through VAM, from a dictionary note. */
	const lookup = {
		named: (basename: string) =>
			vault
				.findByBasename(basename, { ignoreCase: true })
				.pipe(Effect.map((paths) => paths.map(formatPath))),
		resolve: (linkpath: string, from: string) =>
			vault
				.resolveLinkpathDest(linkpath, mdSplitPath(from))
				.pipe(
					Effect.map((found) =>
						found === null ? undefined : formatPath(found),
					),
				),
	} satisfies ScrollLookup<unknown>;

	/** Every stored ref with the Reading note holding it, which its name resolves from. */
	const heldRefs = (): HeldRef[] =>
		index
			.linksWithRefPrefix(ATTESTATION_REF_START)
			.flatMap(({ reading, ref }) => {
				const from = index.readingLocation(readingKeyOf(reading))?.path;
				return from === undefined ? [] : [{ from, ref }];
			});

	/**
	 * How refs of one Reading name one Scroll, resolved from the Reading's
	 * note, as the rename rewrite resolves each ref (#210). A Reading not
	 * stored yet gets its note, and its Lemma's when that is new too, from
	 * its commit: Obsidian cannot see them yet, so a note among them with
	 * the Scroll's basename takes the name from it.
	 */
	const scrollRefNames = Effect.fn("dictionary.scrollRefNames")(function* (
		scrollPath: string,
		reading: Dumling.Reading<"de">,
		surface?: Dumling.Surface<"de">,
	): Effect.fn.Return<ScrollRefNames> {
		const stored = index.readingLocation(readingKeyOf(reading))?.path;
		const lemmaHeld = index.lemmaNote(lemmaKeyOf(reading.lemma))?.path;
		// The Crossroad notes of the spellings the commit lists, when they are
		// not there yet: one may win the Scroll's basename by a shorter path.
		const crossroads = [
			reading.lemma.canonicalForm,
			...(surface === undefined ? [] : [surface.normalizedSurface]),
		].flatMap((spelling) => {
			const path = crossroadPathOf(formKeyOf(spelling, "de"));
			return path === undefined || index.entry(path) !== undefined
				? []
				: [path];
		});
		const unseen = [
			...(stored === undefined ? [canonicalReadingPath(reading)] : []),
			...(lemmaHeld === undefined
				? [canonicalLemmaPath(reading.lemma)]
				: []),
			...crossroads,
		].filter((path) => path !== undefined);
		const from =
			stored ??
			canonicalReadingPath(reading) ??
			`${WORTER_SPLIT_PATH.basename}/${WORTER_SPLIT_PATH.basename}.md`;
		return yield* scrollRefNamesOf(
			scrollPath,
			from,
			heldRefs(),
			lookup,
			unseen,
		).pipe(
			Effect.catch((cause) =>
				Effect.logWarning(
					`Dictionary could not ask Obsidian how refs name ${scrollPath}; new refs name it by its basename where no new note takes it`,
					cause,
				).pipe(Effect.as(basenameRefNames(scrollPath, unseen))),
			),
		);
	});

	/** Refs a rename left to their old name's owner, until its own rename settles them (#199). */
	let deferredRefs: readonly DeferredRefs[] = [];

	/** Waits for the Markdown modifications VAM heard so far; set once the store subscribed. */
	let modificationsCaughtUp: Effect.Effect<void> = Effect.void;

	/**
	 * Rewrites the refs into renamed Scrolls (#99) in one transaction: from
	 * any origin but the store's own, as VAM delivers them. Where each ref
	 * goes is decided first, asking Obsidian how it resolves names
	 * (`retargetForRenames`); the plan, under the lock, moves the refs the
	 * index holds then. A rename heard twice moves nothing the second time.
	 */
	const rewriteScrollRefs = Effect.fn("dictionary.rewriteScrollRefs")(
		function* (
			renames: readonly ScrollRename[],
		): Effect.fn.Return<RefRewrite, DictionaryRefRewriteError> {
			const nothing: RefRewrite = { kept: [], rewritten: 0 };
			const held = heldRefs();
			if (held.length === 0) return nothing;
			const failed = (what: string) => (cause: unknown) =>
				new DictionaryRefRewriteError({
					cause,
					message: `Could not ${what} the refs into ${renames.map(({ from: path, to }) => `${path} → ${to}`).join(", ")}: ${message(cause)}`,
				});
			const now = yield* Clock.currentTimeMillis;
			const { deferred, notes, retarget } = yield* retargetForRenames(
				renames,
				held,
				lookup,
				deferredRefs.filter(
					({ at }) => now - at < DEFERRED_REFS_TTL_MS,
				),
				now,
			).pipe(Effect.mapError(failed("place")));
			deferredRefs = deferred;
			if (notes.length > 0)
				yield* Effect.logWarning(
					"Dictionary left refs into a renamed Scroll as they were",
					notes,
				);
			if (retarget === undefined) return nothing;
			// Obsidian's link updater may have rewritten the Reading notes'
			// Kontexte: their edits land first, so the plan meets no stale file.
			yield* modificationsCaughtUp;
			const outcome = yield* transact(
				(view) => Result.succeed(planRefRewrite(view, retarget)),
				{ maxAttempts: REF_REWRITE_ATTEMPTS },
			).pipe(Effect.mapError(failed("rewrite")));
			if (outcome.kept.length > 0)
				yield* Effect.logWarning(
					"Dictionary left refs into a renamed Scroll that would collide with others",
					outcome.kept,
				);
			return outcome;
		},
	);

	const onBulk = (event: BulkVaultEvent) => {
		const paths: string[] = [];
		const folders: string[] = [];
		for (const vaultEvent of event.events) {
			switch (vaultEvent.kind) {
				case VaultEventKind.FileCreated:
				case VaultEventKind.FileDeleted:
					if (vaultEvent.splitPath.kind === "MdFile")
						paths.push(formatPath(vaultEvent.splitPath));
					break;
				case VaultEventKind.FileRenamed:
					if (vaultEvent.from.kind === "MdFile")
						paths.push(formatPath(vaultEvent.from));
					if (vaultEvent.to.kind === "MdFile")
						paths.push(formatPath(vaultEvent.to));
					break;
				case VaultEventKind.FolderRenamed:
					folders.push(
						formatPath(vaultEvent.from),
						formatPath(vaultEvent.to),
					);
					break;
				case VaultEventKind.FolderDeleted:
					folders.push(formatPath(vaultEvent.splitPath));
					break;
				case VaultEventKind.FolderCreated:
					break;
			}
		}
		/** A folder that is `Worter/` or above it. */
		const above = (folder: string) =>
			isUnder(WORTER_SPLIT_PATH.basename, folder);
		const inside = (folder: string) =>
			isUnder(folder, WORTER_SPLIT_PATH.basename) && !above(folder);
		const whole = folders.some(above);
		const renames = scrollRenamesOf(event);
		const rewrite =
			renames.length === 0
				? Effect.void
				: rewriteScrollRefs(renames).pipe(
						Effect.catch((error) =>
							Effect.logWarning(
								"Dictionary could not rewrite the refs into a renamed Scroll",
								error,
							),
						),
						Effect.asVoid,
					);
		if (!(whole || paths.some(inScope) || folders.some(inside)))
			return rewrite;
		return guarded(
			"event handling",
			whole
				? rebuild().pipe(Effect.andThen(settle))
				: refresh(paths, folders.filter(inside)),
		).pipe(Effect.andThen(rewrite));
	};

	const onModify = (event: BulkMdModifyEvent) =>
		guarded(
			"modify handling",
			refresh(
				event.modifications.map(({ splitPath }) =>
					formatPath(splitPath),
				),
			),
		);

	/**
	 * Commits `intended` against the published index, in the order
	 * `commitChanges` documents, and recovers as it does.
	 */
	const commitIntended = Effect.fnUntraced(function* (
		intended: Intended,
		/** Each touched Lemma's records as the commit read them. */
		bases: Intended,
		depth: number,
	): Effect.fn.Return<CommitChangesResult, DictionaryCommitError> {
		const planned = yield* Effect.result(planCommit(intended));
		if (planned._tag === "Failure") {
			if (planned.failure._tag !== "StaleRead")
				return yield* planned.failure;
			// A refresh that finds nothing new still refuses: the plan read a
			// state the files no longer hold.
			const before = index;
			const changes = yield* rereadChanges([planned.failure.path]);
			if (changes.length === 0) publish(index.clone());
			else
				yield* followUp(
					before,
					new Set(
						changes.flatMap(({ before: was, entry }) =>
							[was, entry].flatMap((note) =>
								note?.kind === "lemma" ||
								note?.kind === "reading"
									? [note.lemmaKey]
									: [],
							),
						),
					),
					new Set(changes.map(({ path }) => path)),
				);
			return conflict("revisionConflict");
		}
		const before = index;
		const { deferred, writes } = planned.success;
		/**
		 * Publishes what landed and answers the commit's revision. The other
		 * notes whose re-render was left out or did not land are read again
		 * and re-rendered; an edit found there moves the revision past the
		 * commit's. A commit that removed Lemmas is then followed by the
		 * re-evaluation their removal asks for (texteater#1257), from a slice
		 * loaded now; dumdict re-evaluates a Lemma's creation itself.
		 */
		const done = (executed: Extract<Executed, { _tag: "Done" }>) =>
			Effect.gen(function* () {
				applied(executed.landed, publish);
				const committed = revision();
				const late: Deferred = {
					formKeys: new Set(deferred.formKeys),
					lemmaKeys: new Set(deferred.lemmaKeys),
					paths: new Set(deferred.paths),
				};
				for (const write of executed.missed) {
					late.paths.add(write.path);
					if (write.lemmaKey !== undefined)
						late.lemmaKeys.add(write.lemmaKey);
					if (write.formKey !== undefined)
						late.formKeys.add(write.formKey);
				}
				if (late.paths.size > 0) {
					yield* refresh(late.paths);
					yield* rerender(late.lemmaKeys, late.formKeys);
				}
				if (depth >= MAX_FOLLOW_UP_DEPTH) return committed;
				const removed: Dumling.Lemma<"de">[] = [];
				for (const [lemmaKey, data] of intended) {
					const was = before.lemmaData(lemmaKey)?.lemmaRecord.lemma;
					if (was && !data) removed.push(was);
				}
				if (removed.length > 0)
					yield* converge(
						{
							removed,
							shadowKeys: new Set(removed.map(shadowKeyOf)),
						},
						depth,
					);
				yield* repairShadowedRefs(false, depth);
				return committed;
			});

		const first = yield* execute(writes);
		if (first._tag === "Done")
			return { nextRevision: yield* done(first), status: "committed" };

		if (first.phase === Phase.Create) {
			// Only new files landed, and VAM took back what it could: with
			// all of them gone, the commit never ran, and the caller plans
			// again.
			const left = createsLeft(first.landed, first.undo);
			const rebuilt = yield* recover;
			if (left.length === 0) return conflict("revisionConflict");
			yield* converge({}, depth + 1);
			if (rebuilt) yield* regenerateCrossroads();
			return yield* new DictionaryWriteError({
				cause: first.cause,
				executed: left,
				externalChange: first.externalChange,
				message: `The commit's creates stopped and could not be undone (${left.join(", ")}): ${message(first.cause)}. The index was ${rebuilt ? "rebuilt from the files" : "not rebuilt; the next operation retries"}.`,
				rebuilt,
				skipped: first.skipped.map(({ path }) => path),
				transient: first.transient,
			});
		}

		// Records landed in some notes: finish the rest from the files.
		const rebuilt = yield* recover;
		const untouched = [...intended].every(([lemmaKey, data]) =>
			onlyThisCommitChanged(
				index.lemmaData(lemmaKey),
				bases.get(lemmaKey),
				data,
			),
		);
		if (rebuilt && !untouched)
			yield* Effect.logWarning(
				"Dictionary did not finish a stopped commit: another writer changed its notes meanwhile",
			);
		if (rebuilt && untouched) {
			const again = yield* Effect.result(planCommit(intended));
			if (again._tag === "Success") {
				for (const path of again.success.deferred.paths)
					deferred.paths.add(path);
				for (const key of again.success.deferred.lemmaKeys)
					deferred.lemmaKeys.add(key);
				for (const key of again.success.deferred.formKeys)
					deferred.formKeys.add(key);
				const second = yield* execute(again.success.writes);
				if (second._tag === "Done") {
					yield* Effect.logWarning(
						"Dictionary finished a commit whose writes had stopped",
						first.cause,
					);
					return {
						nextRevision: yield* done(second),
						status: "committed",
					};
				}
				yield* recover;
			}
		}
		yield* converge({}, depth + 1);
		if (rebuilt) yield* regenerateCrossroads();
		return yield* new DictionaryWriteError({
			cause: first.cause,
			executed: first.landed.map(({ path }) => path),
			externalChange: first.externalChange,
			message: `The commit's writes stopped: ${message(first.cause)}. The index was ${rebuilt ? "rebuilt from the files" : "not rebuilt; the next operation retries"}.`,
			rebuilt,
			skipped: first.skipped.map(({ path }) => path),
			transient: first.transient,
		});
	});

	function commitUnderLock(
		request: CommitChangesRequest<"de"> | DumdictPlan<"de">,
		depth = 0,
	): Effect.Effect<CommitChangesResult, DictionaryCommitError> {
		return Effect.gen(function* () {
			if (stale) {
				yield* rebuild();
				yield* settle;
			}
			const parsed = parseAsCommitChangesRequest(request, "de");
			if (parsed instanceof ParsingError)
				return yield* new DictionaryRequestError({
					cause: parsed,
					message: `The commit request is invalid: ${parsed.issues.map((issue) => issue.message).join("; ")}`,
				});
			if (parsed.baseRevision !== revision())
				return conflict("revisionConflict");

			const staged = yield* Effect.try({
				catch: (cause) =>
					new DictionaryRequestError({
						cause,
						message: message(cause),
					}),
				try: () => stageChanges(index, revision(), parsed.changes),
			});
			if (staged._tag === "PreconditionFailed")
				return conflict("semanticPreconditionFailed");
			if (staged.notes.length === 0)
				return {
					nextRevision: revision(),
					status: "committed",
				} as const;
			const intended: Intended = new Map(
				staged.notes.map(({ data, lemmaKey }) => [
					lemmaKey,
					data === undefined ? undefined : canonicalData(data),
				]),
			);
			const bases: Intended = new Map(
				staged.notes.map(({ base, lemmaKey }) => [lemmaKey, base]),
			);
			return yield* commitIntended(intended, bases, depth);
		});
	}

	/** How often a freeform placement reads the note again after it changed. */
	const FREEFORM_ATTEMPTS = 3;

	const appendFreeformUnderLock = Effect.fnUntraced(function* (request: {
		readonly path: string;
		readonly text: string;
	}): Effect.fn.Return<
		"Appended" | "AlreadyThere",
		DictionaryRequestError | DictionaryScanError
	> {
		if (stale) {
			yield* rebuild();
			yield* settle;
		}
		const { path } = request;
		const refuse = (reason: string, cause: unknown = path) =>
			new DictionaryRequestError({
				cause,
				message: `Could not place freeform text in ${path}: ${reason}`,
			});
		const text = placedFreeform(request.text);
		if (text.trim() === "") return yield* refuse("the text is empty");
		for (let attempt = 1; ; attempt += 1) {
			const view = index;
			const indexed = view.entry(path);
			const held =
				indexed?.kind === "lemma" || indexed?.kind === "reading"
					? view.lemmaNote(indexed.lemmaKey)
					: undefined;
			const records = held?.data;
			const reading =
				indexed?.kind === "reading" &&
				held?.readingPaths.get(indexed.readingKey) === path
					? indexed.data.readingEntry.reading
					: undefined;
			if (
				records === undefined ||
				(indexed?.kind === "lemma" && held?.path !== path) ||
				(indexed?.kind === "reading" && reading === undefined)
			)
				return yield* refuse(
					"the store holds no readable Lemma or Reading note there",
				);
			const kind = indexed?.kind === "lemma" ? "lemma" : "reading";
			const current = yield* Effect.result(readCurrent(view, path));
			if (current._tag === "Failure") {
				// The file is ahead of the index: an edit no event has
				// delivered yet. Read it and place the text into that.
				yield* rereadChanges([path]);
				if (attempt < FREEFORM_ATTEMPTS) continue;
				return yield* refuse(
					"the note kept changing while the store read it",
				);
			}
			if (holdsFreeform(freeformOfNote(current.success, kind), text))
				return "AlreadyThere";
			const { options: render } = renderOptionsFor(
				view,
				projections,
				metadataFormat(),
			);
			const write = { ...render, extraFreeform: [text] };
			const next = yield* Effect.try({
				catch: (cause) => refuse(message(cause), cause),
				try: () =>
					reading === undefined
						? writeLemmaNote(records, write)(current.success)
						: writeReadingNote(
								records,
								reading,
								write,
							)(current.success),
			});
			const problem = placedNoteProblem({
				content: next,
				data:
					indexed?.kind === "lemma" || indexed?.kind === "reading"
						? indexed.data
						: undefined,
				kind,
				path,
				text,
			});
			if (problem !== undefined) return yield* refuse(problem);
			const entry = classifyFile(path, next);
			const outcome = yield* Effect.result(
				dispatch([compareAndSwap(path, current.success, next)]),
			);
			if (outcome._tag === "Success") {
				// No record changed, so plans made at this revision stay valid.
				const published = index.clone();
				published.set(path, entry);
				cache?.delete(path);
				publishRendering(published);
				return "Appended";
			}
			const changes = yield* rereadChanges([path]);
			if (changes.length > 0 && attempt < FREEFORM_ATTEMPTS) continue;
			return yield* refuse(
				`the write failed: ${message(outcome.failure)}`,
				outcome.failure,
			);
		}
	});

	/**
	 * The table re-render (#121). Tables are projections (system ADR 0049),
	 * so a pack or Table Schema change needs no data migration, but notes
	 * rendered before it show stale tables. A Lemma note records the
	 * versions it was rendered at; the index tells the stale ones from
	 * their metadata alone (`staleTables`), and each is re-rendered from
	 * its records like any other re-render: compare-and-swaps on the
	 * content read, freeform and edited renderings kept, writing only the
	 * notes whose metadata changes. Its Reading notes go first and its Lemma
	 * note last, so a note that records the current versions never stands
	 * beside an embed still stale. Table Block IDs hash Licence Groups'
	 * selection keys, never versions, so the embeds stay where they were.
	 *
	 * A run takes chunks of {@link TABLES_CHUNK} Lemmas, each under the
	 * writer lock, so commits and events go between them and startup never
	 * waits for it. It ends when a fresh look finds no stale Lemma but those
	 * it gave up on, whose notes it could not write; the next full read
	 * tries them again. Re-rendering is idempotent: a second run writes
	 * nothing.
	 */
	let tablesRun: Fiber.Fiber<TablesRerendered> | undefined;
	let tablesRunning = false;
	let closed = false;

	const tablesChunk = Effect.fnUntraced(function* (
		keys: readonly string[],
		gaveUp: Set<string>,
	) {
		if (stale && (yield* recover)) yield* settle;
		const chunk = staleTables(index, projections?.inflection, keys);
		if (chunk.length === 0) return { lemmas: 0, notes: 0 };
		const landed = yield* rerender(
			new Set(chunk),
			new Set(),
			new Set(),
			true,
		);
		const left = new Set(
			staleTables(index, projections?.inflection, chunk),
		);
		for (const key of left) gaveUp.add(key);
		return { lemmas: chunk.length - left.size, notes: landed.size };
	});

	const tablesLoop = Effect.gen(function* () {
		const gaveUp = new Set<string>();
		let lemmas = 0;
		let notes = 0;
		for (;;) {
			const pending = staleTables(index, projections?.inflection).filter(
				(key) => !gaveUp.has(key),
			);
			if (pending.length === 0) break;
			for (let at = 0; at < pending.length; at += TABLES_CHUNK) {
				const keys = pending.slice(at, at + TABLES_CHUNK);
				const done = yield* lock.withPermit(
					tablesChunk(keys, gaveUp).pipe(
						Effect.onError(() => markStale),
						Effect.ensuring(report),
					),
				);
				lemmas += done.lemmas;
				notes += done.notes;
				yield* Effect.yieldNow;
			}
		}
		// No yield since the last look: a full read from now on starts a run.
		tablesRunning = false;
		const result: TablesRerendered = {
			lemmas,
			notes,
			remaining: gaveUp.size,
		};
		if ((lemmas > 0 || gaveUp.size > 0) && options.onTablesRerendered)
			yield* options.onTablesRerendered(result);
		if (gaveUp.size > 0)
			yield* Effect.logWarning(
				"Dictionary could not re-render the tables of some notes; the next full read tries again",
				[...gaveUp],
			);
		return result;
	}).pipe(
		Effect.catchCause((cause) =>
			Cause.hasInterruptsOnly(cause)
				? Effect.failCause(cause)
				: Effect.logError(
						"Dictionary table re-render failed",
						cause,
					).pipe(
						Effect.andThen(
							Effect.sync((): TablesRerendered => {
								tablesRunning = false;
								return { lemmas: 0, notes: 0, remaining: 0 };
							}),
						),
					),
		),
		Effect.onInterrupt(() =>
			Effect.sync(() => {
				tablesRunning = false;
			}),
		),
	);

	/** Starts a table re-render in the background, unless one is in flight. */
	function startTables(): Effect.Effect<void> {
		return Effect.suspend(() => {
			if (tablesRunning || closed) return Effect.void;
			tablesRunning = true;
			return Effect.forkDetach(tablesLoop).pipe(
				Effect.tap((fiber) =>
					Effect.sync(() => {
						tablesRun = fiber;
					}),
				),
				Effect.asVoid,
			);
		});
	}
	/** Starts a run unless one is in flight, and waits for it. */
	const refreshTables = startTables().pipe(
		Effect.andThen(
			Effect.suspend(() =>
				closed || tablesRun === undefined
					? Effect.succeed<TablesRerendered>({
							lemmas: 0,
							notes: 0,
							remaining: 0,
						})
					: Fiber.join(tablesRun),
			),
		),
	);

	const bulkSubscription = yield* vault
		.subscribeToBulk(onBulk, DICTIONARY_EVENTS)
		.pipe(Effect.mapError(scanError("observe")));
	const modifySubscription = yield* vault
		.subscribeToMdModifications(
			WORTER_SPLIT_PATH,
			onModify,
			DICTIONARY_EVENTS,
		)
		.pipe(Effect.mapError(scanError("observe edits in")));
	modificationsCaughtUp = Effect.ignore(modifySubscription.caughtUp);
	const close = Effect.all(
		[bulkSubscription.close, modifySubscription.close].map((closing) =>
			Effect.ignore(closing),
		),
		{ discard: true },
	).pipe(
		Effect.andThen(
			Effect.suspend(() => {
				closed = true;
				return tablesRun === undefined
					? Effect.void
					: Fiber.interrupt(tablesRun);
			}),
		),
	);

	yield* lock
		.withPermit(
			Effect.gen(function* () {
				yield* rebuild();
				yield* settle;
				yield* report;
			}),
		)
		.pipe(Effect.onError(() => close));

	/** Reads against the index version published when they run. */
	const live = () => viewOf(index, revision());

	return {
		appendFreeform: (request) =>
			lock.withPermit(
				appendFreeformUnderLock(request).pipe(Effect.ensuring(report)),
			),
		attestationLinksWithRefPrefix: (prefix) =>
			Effect.sync(() => live().attestationLinksWithRefPrefix(prefix)),
		caughtUp: Effect.all(
			[bulkSubscription.caughtUp, modifySubscription.caughtUp].map(
				(caughtUp) => Effect.ignore(caughtUp),
			),
			{ concurrency: "unbounded", discard: true },
		),
		close,
		commitChanges: (request) =>
			lock.withPermit(
				commitUnderLock(request).pipe(Effect.ensuring(report)),
			),
		diagnostics: Effect.sync(() => diagnosticsOf(index)),
		lemmaCandidates: (texts) =>
			Effect.sync(() => live().lemmaCandidates(texts)),
		lemmaNote: (lemma) => Effect.sync(() => live().lemmaNote(lemma)),
		lemmaNotes: Effect.sync(() => live().lemmaNotes()),
		loadCleanupRelationsContext: (request) =>
			Effect.suspend(() =>
				Effect.fromResult(live().loadCleanupRelationsContext(request)),
			),
		loadOccurrenceSlice: (request) =>
			Effect.sync(() => live().loadOccurrenceSlice(request)),
		loadReadingEntryContext: (request) =>
			Effect.suspend(() =>
				Effect.fromResult(live().loadReadingEntryContext(request)),
			),
		loadReevaluateShadowsContext: (request) =>
			Effect.suspend(() =>
				Effect.fromResult(live().loadReevaluateShadowsContext(request)),
			),
		loadRekeySurfacesSlice: (request) =>
			Effect.sync(() => live().loadRekeySurfacesSlice(request)),
		readingLocation: (reading) =>
			Effect.sync(() => live().readingLocation(reading)),
		refreshTables,
		relationEdgesTo: (lemma) =>
			Effect.sync(() => live().relationEdgesTo(lemma)),
		rescan: lock.withPermit(
			rebuild().pipe(Effect.andThen(settle), Effect.ensuring(report)),
		),
		revision: Effect.sync(revision),
		scrollRefNames,
		surface: (surfaceId) => Effect.sync(() => live().surface(surfaceId)),
		transact,
	};
});
