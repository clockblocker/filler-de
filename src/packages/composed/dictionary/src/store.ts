import {
	crossroadNotePath,
	findPathCollisions,
	lemmaNoteOwner,
	NoteSerializeError,
	type PathClaim,
	readingNoteOwner,
} from "@textfresser/lemma-note-codec";
import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	VamDispatchStoppedError,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { canonicalJson } from "common-utils";
import {
	type CommitChangesRequest,
	type CommitChangesResult,
	type DumdictPlan,
	ParsingError,
	type PendingSemanticRelationRecord,
	parseAsCommitChangesRequest,
	type ReadingEntry,
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
import { Data, Effect, Semaphore } from "effect";
import { contentHash } from "./content-hash";
import {
	CrossroadNoteMetadata,
	crossroadMetadataOf,
	writeCrossroadNote,
} from "./crossroad";
import {
	type DictionaryCommitError,
	DictionaryPathOccupiedError,
	DictionaryRequestError,
	DictionaryRoundTripError,
	DictionaryScanError,
	DictionaryWriteError,
} from "./errors";
import { freeformOfNote, holdsFreeform, placedFreeform } from "./freeform";
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
import {
	crossroadContentOf,
	fanOutOf,
	type NoteProjections,
	renderOptionsFor,
} from "./render";
import {
	loadCleanupRelationsContext,
	loadOccurrenceSlice,
	loadReadingEntryContext,
	loadReevaluateShadowsContext,
	loadRekeySurfacesSlice,
} from "./slices";
import { stageChanges } from "./stage-changes";
import {
	createOnlySplitPath,
	type DictionaryVault,
	folderSplitPath,
	formatPath,
	inScope,
	isUnder,
	mdSplitPath,
	WORTER_SPLIT_PATH,
} from "./vault";

/** A stored Lemma dumgen may name a unit by, and the texts it was found under. */
export type LemmaCandidate = {
	readonly lemma: Dumling.Lemma<"de">;
	readonly foundUnder: readonly string[];
};

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
	/** Notes directly in `Worter/` without dictionary metadata (#115 heals them). */
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
	/** Called after the index is built or changes, with the current diagnostics. */
	readonly onDiagnostics?: (diagnostics: DictionaryDiagnostics) => void;
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
	}) => Effect.Effect<CleanupRelationsSlice<"de">>;
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
	 * A failure among the creates removes the notes it created and answers
	 * a conflict, as if nothing was written. A later failure rebuilds the
	 * index from the files and writes what is still missing once more; only
	 * if that fails too is a `DictionaryWriteError` returned, with the index
	 * rebuilt. Every rebuild re-evaluates the stored Shadows the files'
	 * Lemmas no longer fit, so links converge. A commit that adds or removes
	 * Lemmas is followed by that re-evaluation too, as its own commit.
	 */
	readonly commitChanges: (
		request: CommitChangesRequest<"de"> | DumdictPlan<"de">,
	) => Effect.Effect<CommitChangesResult, DictionaryCommitError>;
	/** The current revision; it moves on every observed change under `Worter/`. */
	readonly revision: Effect.Effect<StoreRevision>;

	/** Stored Lemmas whose Canonical Form or owned Surface is one of these texts. */
	readonly lemmaCandidates: (
		texts: readonly string[],
	) => Effect.Effect<LemmaCandidate[]>;
	/** A Lemma's note paths and records, if it is stored. */
	readonly lemmaNote: (lemma: Dumling.Lemma<"de">) => Effect.Effect<
		| {
				readonly path: string;
				readonly readings: readonly ReadingEntry<"de">[];
				readonly ownedSurfaces: readonly SurfaceEntry<"de">[];
				readonly pendingRelations: readonly PendingSemanticRelationRecord<"de">[];
		  }
		| undefined
	>;
	/** Every stored Lemma and the path of its Lemma note, by path. */
	readonly lemmaNotes: Effect.Effect<
		readonly {
			readonly path: string;
			readonly lemma: Dumling.Lemma<"de">;
		}[]
	>;
	/** Where a Reading lives: its Reading note and its Lemma note. */
	readonly readingLocation: (
		reading: Dumling.Reading<"de">,
	) => Effect.Effect<ReadingLocation | undefined>;
	readonly surface: (
		surfaceId: SurfaceEntry<"de">["id"],
	) => Effect.Effect<SurfaceEntry<"de"> | undefined>;
	/** Stored relations whose target is this Lemma or one of its Readings. */
	readonly relationEdgesTo: (
		lemma: Dumling.Lemma<"de">,
	) => Effect.Effect<RelationEdge[]>;
	readonly diagnostics: Effect.Effect<DictionaryDiagnostics>;
	/**
	 * Rebuilds the index from a full scan of `Worter/`. A caller that moved
	 * or created files there through VAM runs it: VAM keeps its own writes
	 * from the store as Self Events.
	 */
	readonly rescan: Effect.Effect<void, DictionaryScanError>;
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

function actionPath(action: VaultAction): string {
	const payload = action.payload as {
		readonly splitPath?: Parameters<typeof formatPath>[0];
		readonly to?: Parameters<typeof formatPath>[0];
	};
	const target = payload.to ?? payload.splitPath;
	return target ? formatPath(target) : action.kind;
}

/** A rewrite that lands only on the content it was planned from. */
function compareAndSwap(path: string, expected: string, next: string) {
	return (onDisk: string) => {
		if (onDisk !== expected)
			throw new Error(`${path} changed after the store read it`);
		return next;
	};
}

/** The index was behind the file at `path`: the caller re-reads and re-plans. */
class StaleRead extends Data.TaggedError("StaleRead")<{
	readonly path: string;
}> {}

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
	/** What a note sent to the trash must still hold when it goes. */
	readonly expected?: string;
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
	const session = `${Date.now().toString(36)}${sessionCounter.toString(36)}`;
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

	const report = Effect.sync(() => {
		if (!options.onDiagnostics) return;
		const diagnostics = diagnosticsOf(index);
		const fingerprint = JSON.stringify(diagnostics);
		if (fingerprint === lastDiagnostics) return;
		lastDiagnostics = fingerprint;
		options.onDiagnostics(diagnostics);
	});

	/**
	 * VAM's stop-on-first-failure dispatch. VAM finishes a batch it accepted,
	 * so the store waits for it rather than release its lock mid-write; an
	 * interrupt before that still leaves the index stale.
	 */
	const dispatch = (actions: readonly VaultAction[]) =>
		Effect.uninterruptible(vault.dispatchStopOnFirstFailure(actions)).pipe(
			Effect.onInterrupt(() => markStale),
		);

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
		for (const { path, entry } of changes) next.set(path, entry);
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
	 * Moves Lemma and Reading notes whose path disagrees with their
	 * metadata to their own path, unless a file is already there. The index
	 * learns the outcome from the files, not from what the move was meant to
	 * do; a move that fails or lands elsewhere rebuilds the index and heals
	 * once more.
	 */
	const heal = Effect.fnUntraced(function* (
		retry = true,
	): Effect.fn.Return<void> {
		const blocked: HealingBlocked[] = [];
		const moves: { from: string; to: string; hash: string }[] = [];
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
			if (moving === undefined) continue;
			if (failedMoves.get(moveKey(from, to)) === moving.hash) {
				blocked.push({
					canonicalPath: to,
					message:
						"Moving it to its own path failed; the store tries again once the note changes",
					path: from,
				});
				continue;
			}
			const collision = index.folderCollision(to);
			const occupied =
				index.sameFileAs(to).length > 0 ||
				collision !== undefined ||
				(yield* vault
					.exists(mdSplitPath(to))
					.pipe(Effect.orElseSucceed(() => true)));
			if (occupied)
				blocked.push({
					canonicalPath: to,
					message:
						collision === undefined
							? "Another file sits at its own path; the two may be duplicates"
							: `Its folder ${collision.folder} collides with ${collision.existing}`,
					path: from,
				});
			else moves.push({ from, hash: moving.hash, to });
		}
		healingBlocked = blocked;
		if (moves.length === 0) return;
		const outcome = yield* Effect.result(
			dispatch(
				moves.map(
					({ from, to }): VaultAction => ({
						kind: VaultActionKind.RenameMdFile,
						payload: {
							from: mdSplitPath(from),
							to: mdSplitPath(to),
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
		if (outcome._tag === "Success" && moves.every(landed)) return;
		const rebuilt = yield* recover;
		for (const move of moves) {
			const left = index.entry(move.from);
			if (!landed(move) && left !== undefined)
				failedMoves.set(moveKey(move.from, move.to), left.hash);
		}
		if (rebuilt && retry) return yield* heal(false);
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
					action: {
						kind: VaultActionKind.ProcessMdFile,
						payload: {
							splitPath: mdSplitPath(path),
							transform: compareAndSwap(path, current, next),
						},
					},
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
				action: {
					kind: VaultActionKind.CreateFile,
					payload: {
						content,
						splitPath: createOnlySplitPath(note.path),
					},
				},
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
		/** Sends a note to the trash, once its file still holds what was read. */
		const trash = (
			path: string,
			phase: Phase,
			expected: string,
		): PlannedWrite => ({
			action: {
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdSplitPath(path) },
			},
			content: undefined,
			expected,
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
		let path: string;
		try {
			path = crossroadNotePath(key, "de").path;
		} catch {
			return [];
		}
		if (skip.has(path)) return [];
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
					action: {
						kind: VaultActionKind.CreateFile,
						payload: {
							content: created,
							splitPath: createOnlySplitPath(path),
						},
					},
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
		const current = yield* readCurrent(view, path);
		const next = write(current);
		const changed =
			extra.length > 0 || crossroadMetadataOf(current) === undefined
				? next !== current
				: !sameMetadata(current, next, CrossroadNoteMetadata);
		if (!changed) return [];
		return [
			{
				action: {
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						splitPath: mdSplitPath(path),
						transform: compareAndSwap(path, current, next),
					},
				},
				content: next,
				formKey: key,
				path,
				// Text moved from removed notes must land before they go.
				phase: extra.length > 0 ? Phase.Own : Phase.FanOut,
			},
		];
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
				/** Whether the failed batch may have landed writes it did not report. */
				readonly uncertain: boolean;
				readonly skipped: readonly PlannedWrite[];
				readonly cause: unknown;
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
			// A note goes to the trash only while it holds what the commit
			// read, so text typed into it meanwhile is moved, not lost.
			for (const write of batch) {
				if (write.expected === undefined) continue;
				const read = yield* Effect.result(
					vault.readContentWithStat(mdSplitPath(write.path)),
				);
				if (
					read._tag === "Success" &&
					read.success.content === write.expected
				)
					continue;
				return {
					_tag: "Failed",
					cause: new Error(
						`${write.path} changed after the store read it`,
					),
					landed,
					phase,
					skipped: writes.filter((later) => later.phase >= phase),
					uncertain: false,
				} as const;
			}
			const outcome = yield* Effect.result(
				dispatch(batch.map(({ action }) => action)),
			);
			if (outcome._tag === "Success") {
				landed.push(...batch);
				continue;
			}
			const failure = outcome.failure;
			const stopped = failure instanceof VamDispatchStoppedError;
			const executed = new Set(
				(stopped ? failure.executed : [])
					.filter(
						(action) =>
							action.kind !== VaultActionKind.CreateFolder,
					)
					.map(actionPath),
			);
			// VAM fails planning and overflow before it runs any action.
			const ranNothing =
				!stopped &&
				(failure._tag === "VamPlanningError" ||
					failure._tag === "VamDispatchOverflowError");
			if (phase === Phase.FanOut) {
				const ran = (write: PlannedWrite) =>
					stopped && executed.has(write.path);
				landed.push(...batch.filter(ran));
				missed.push(...batch.filter((write) => !ran(write)));
				yield* Effect.logWarning(
					"Dictionary re-renders of other notes stopped; they are read again after the commit",
					failure,
				);
				continue;
			}
			const later = writes.filter((write) => write.phase > phase);
			return {
				_tag: "Failed",
				cause: stopped ? failure.failure.cause : failure,
				landed: [
					...landed,
					...batch.filter(({ path }) => executed.has(path)),
				],
				phase,
				skipped: [
					...batch.filter(({ path }) => !executed.has(path)),
					...later,
				],
				uncertain: !(stopped || ranNothing),
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
	) {
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
			if (writes.length > 0) {
				const outcome = yield* Effect.result(
					dispatch(writes.map(({ action }) => action)),
				);
				if (outcome._tag === "Success")
					applied(writes, publishRendering);
				else {
					yield* Effect.logWarning(
						"Dictionary re-renders stopped; re-reading the notes",
						outcome.failure,
					);
					yield* rereadChanges(writes.map(({ path }) => path));
					for (const key of pendingLemmas) retryLemmas.add(key);
					for (const key of pendingForms) retryForms.add(key);
				}
			}
			pendingLemmas = [...retryLemmas].sort(byCodeUnit);
			pendingForms = [...retryForms].sort(byCodeUnit);
		}
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

	const logIssues = (outcome: DumdictPlanOutcome<"de">) =>
		outcome.status === "planned" && (outcome.issues?.length ?? 0) > 0
			? Effect.logWarning(
					"Dictionary re-evaluation worked around stored claims",
					outcome.issues,
				)
			: Effect.void;

	/**
	 * Re-evaluates every stored Shadow relation whose resolution the Lemmas
	 * no longer fit, and moves the claims on Lemmas the files no longer hold
	 * (`reevaluateShadows`), as commits of their own, from slices loaded
	 * now. It is what makes links converge after a removal, a hand edit or
	 * a failed commit. `scope` narrows it to the Shadows of Lemmas a change
	 * added or removed; `removed` names Lemmas removed by a plan. It never
	 * fails.
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
			const shadows = new Map<
				string,
				PendingSemanticRelationRecord<"de">["pending"]["target"]
			>();
			for (const record of view.allPending()) {
				const key = pendingShadowKeyOf(record);
				if (
					scope.shadowKeys !== undefined &&
					!scope.shadowKeys.has(key)
				)
					continue;
				if (unsettled(view, record))
					shadows.set(key, record.pending.target);
			}
			if (removed.size === 0 && shadows.size === 0) return;
			const shadowList = [...shadows.values()];
			const requests: Omit<
				ReevaluateShadowsRequest<"de">,
				"baseRevision"
			>[] = [];
			for (
				let at = 0;
				at < Math.max(shadowList.length, 1);
				at += REEVALUATION_CHUNK
			)
				requests.push({
					...(at === 0 && removed.size > 0
						? { removedLemmas: [...removed.values()] }
						: {}),
					shadows: shadowList.slice(at, at + REEVALUATION_CHUNK),
				});
			for (const request of requests) {
				const slice = yield* Effect.try({
					catch: (cause) => cause,
					try: () =>
						loadReevaluateShadowsContext(
							index,
							revision(),
							request,
						),
				}).pipe(Effect.option);
				if (slice._tag === "None") {
					yield* Effect.logWarning(
						"Dictionary could not load a Shadow re-evaluation slice",
					);
					continue;
				}
				const outcome = planner.reevaluateShadows(slice.value, {
					...request,
					baseRevision: slice.value.revision,
				});
				yield* logIssues(outcome);
				if (outcome.status !== "planned") {
					yield* Effect.logWarning(
						"Dictionary could not re-evaluate Shadows",
						outcome,
					);
					continue;
				}
				if (outcome.plan.changes.length === 0) continue;
				const result = yield* Effect.result(
					commitUnderLock(outcome.plan, depth + 1),
				);
				if (
					result._tag === "Failure" ||
					result.success.status !== "committed"
				)
					yield* Effect.logWarning(
						"Dictionary Shadow re-evaluation did not commit",
						result._tag === "Failure"
							? result.failure
							: result.success,
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

	/** After a full read of `Worter/`: heal, then let links converge. */
	const settle = heal().pipe(
		Effect.andThen(Effect.suspend(() => converge())),
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
			if (!inScope(`${folder}/`)) continue;
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
		yield* heal();
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
		yield* followUp(
			before,
			touched,
			new Set(changes.map(({ path }) => path)),
		);
		return true;
	});

	/** Event work: serialized with commits; a failure leaves the index stale. */
	const guarded = <E>(label: string, effect: Effect.Effect<unknown, E>) =>
		lock
			.withPermit(
				Effect.gen(function* () {
					if (stale && (yield* recover)) yield* settle;
					yield* effect;
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
			inScope(`${folder}/`) && !above(folder);
		const whole = folders.some(above);
		if (!(whole || paths.some(inScope) || folders.some(inside)))
			return Effect.void;
		return guarded(
			"event handling",
			whole
				? rebuild().pipe(Effect.andThen(settle))
				: refresh(paths, folders.filter(inside)),
		);
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
				return committed;
			});

		const first = yield* execute(writes);
		if (first._tag === "Done")
			return { nextRevision: yield* done(first), status: "committed" };

		if (first.phase === Phase.Create) {
			// Only new files landed: send them back to the trash, as if the
			// commit had never run, and let the caller plan again.
			const rollback =
				first.landed.length === 0
					? ({ _tag: "Success" } as const)
					: yield* Effect.result(
							dispatch(
								first.landed.map(
									({ path }): VaultAction => ({
										kind: VaultActionKind.TrashMdFile,
										payload: {
											splitPath: mdSplitPath(path),
										},
									}),
								),
							),
						);
			const rebuilt = yield* recover;
			if (rollback._tag === "Success" && !first.uncertain)
				return conflict("revisionConflict");
			yield* converge({}, depth + 1);
			return yield* new DictionaryWriteError({
				cause: first.cause,
				executed: first.landed.map(({ path }) => path),
				message: `The commit's creates stopped and could not be undone: ${message(first.cause)}. The index was ${rebuilt ? "rebuilt from the files" : "not rebuilt; the next operation retries"}.`,
				rebuilt,
				skipped: first.skipped.map(({ path }) => path),
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
		return yield* new DictionaryWriteError({
			cause: first.cause,
			executed: first.landed.map(({ path }) => path),
			message: `The commit's writes stopped: ${message(first.cause)}. The index was ${rebuilt ? "rebuilt from the files" : "not rebuilt; the next operation retries"}.`,
			rebuilt,
			skipped: first.skipped.map(({ path }) => path),
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
			const entry = classifyFile(path, next);
			const sameRecords =
				(entry.kind === "lemma" || entry.kind === "reading") &&
				entry.kind === indexed?.kind &&
				sameJson(entry.data, indexed.data);
			if (
				!sameRecords ||
				!holdsFreeform(freeformOfNote(next, kind), text)
			)
				return yield* refuse(
					"the note would not parse back to its records with the text in it",
				);
			const outcome = yield* Effect.result(
				dispatch([
					{
						kind: VaultActionKind.ProcessMdFile,
						payload: {
							splitPath: mdSplitPath(path),
							transform: compareAndSwap(
								path,
								current.success,
								next,
							),
						},
					},
				]),
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

	const bulkSubscription = yield* vault
		.subscribeToBulk(onBulk)
		.pipe(Effect.mapError(scanError("observe")));
	const modifySubscription = yield* vault
		.subscribeToMdModifications(WORTER_SPLIT_PATH, onModify)
		.pipe(Effect.mapError(scanError("observe edits in")));
	const close = Effect.all(
		[bulkSubscription.close, modifySubscription.close].map((closing) =>
			Effect.ignore(closing),
		),
		{ discard: true },
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

	/** A read against one published index version. */
	const read = <A>(f: (view: NoteIndex) => A) => Effect.sync(() => f(index));

	const requestError = (cause: unknown) =>
		new DictionaryRequestError({ cause, message: message(cause) });

	return {
		appendFreeform: (request) =>
			lock.withPermit(
				appendFreeformUnderLock(request).pipe(Effect.ensuring(report)),
			),
		close,
		commitChanges: (request) =>
			lock.withPermit(
				commitUnderLock(request).pipe(Effect.ensuring(report)),
			),
		diagnostics: read(diagnosticsOf),
		lemmaCandidates: (texts) =>
			read((view) => {
				const found = new Map<
					string,
					{ lemma: Dumling.Lemma<"de">; foundUnder: string[] }
				>();
				for (const text of texts)
					for (const key of view.lemmasWithForm(
						formKeyOf(text, "de"),
					)) {
						const lemma = view.lemmaData(key)?.lemmaRecord.lemma;
						if (!lemma) continue;
						const candidate = found.get(key) ?? {
							foundUnder: [],
							lemma,
						};
						if (!candidate.foundUnder.includes(text))
							candidate.foundUnder.push(text);
						found.set(key, candidate);
					}
				return [...found.values()];
			}),
		lemmaNote: (lemma) =>
			read((view) => {
				const note = view.lemmaNote(lemmaKeyOf(lemma));
				return note
					? {
							ownedSurfaces: note.data.ownedSurfaceEntries,
							path: note.path,
							pendingRelations: note.data.pendingRelations,
							readings: note.data.readingEntries,
						}
					: undefined;
			}),
		lemmaNotes: read((view) =>
			view.lemmaNotes().map(({ data, path }) => ({
				lemma: data.lemmaRecord.lemma,
				path,
			})),
		),
		loadCleanupRelationsContext: (request) =>
			read((view) =>
				loadCleanupRelationsContext(view, revision(), request),
			),
		loadOccurrenceSlice: (request) =>
			read((view) => loadOccurrenceSlice(view, revision(), request)),
		loadReadingEntryContext: (request) =>
			Effect.try({
				catch: requestError,
				try: () => loadReadingEntryContext(index, revision(), request),
			}),
		loadReevaluateShadowsContext: (request) =>
			Effect.try({
				catch: requestError,
				try: () =>
					loadReevaluateShadowsContext(index, revision(), request),
			}),
		loadRekeySurfacesSlice: (request) =>
			read((view) => loadRekeySurfacesSlice(view, revision(), request)),
		readingLocation: (reading) =>
			read((view) => view.readingLocation(readingKeyOf(reading))),
		relationEdgesTo: (lemma) =>
			read((view) => view.edgesTo(lemmaKeyOf(lemma))),
		rescan: lock.withPermit(
			rebuild().pipe(Effect.andThen(settle), Effect.ensuring(report)),
		),
		revision: Effect.sync(revision),
		surface: (surfaceId) => read((view) => view.surface(surfaceId)),
	};
});
