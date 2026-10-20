import {
	LemmaNoteSerializeError,
	type Projections,
	parse,
	serialize,
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
import type {
	CleanupRelationsSlice,
	LoadReadingEntryContextRequest,
	ReadingEntryContext,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { Effect, Semaphore } from "effect";
import { contentHash } from "./content-hash";
import {
	type DictionaryCommitError,
	DictionaryPathOccupiedError,
	DictionaryRequestError,
	DictionaryRoundTripError,
	DictionaryScanError,
	DictionaryWriteError,
} from "./errors";
import { holdsFreeformBlock, insertFreeformBlock } from "./freeform";
import {
	inverseRelationsReader,
	showsOtherInverseRelations,
	withInverseRelations,
} from "./inverse-relations";
import { formKeyOf, lemmaKeyOf, readingKeyOf } from "./keys";
import {
	cacheHit,
	type DictionaryNoteCache,
	fromCached,
	toCached,
} from "./note-cache";
import {
	classifyNote,
	type LemmaNoteEntry,
	lemmaEntry,
	type NoteData,
	type PathEntry,
	type QuarantineReason,
	sameEntry,
	unreadableEntry,
} from "./note-entry";
import {
	byCodeUnit,
	canonicalLemmaPath,
	NoteIndex,
	type ReadingLocation,
	type RelationEdge,
	relationEdgesOf,
	shadowPathOf,
	shadowRefOf,
} from "./note-index";
import { isStoreShadow, shadowBody } from "./shadow-note";
import { loadCleanupRelationsContext, loadReadingEntryContext } from "./slices";
import { type StagedNote, stageChanges } from "./stage-changes";
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
				readonly _tag: "DuplicateLemma";
				/** The note that holds the Lemma instead. */
				readonly heldBy: string;
			};
	  };

/** A Lemma note whose path disagrees with its metadata and that stays put. */
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
	 * Shadow notes no pending relation needs any more that hold content the
	 * store did not write. The store leaves them to the user.
	 */
	readonly userShadows: readonly string[];
	/** Folders or files the last full scan could not read. */
	readonly scanIssues: readonly string[];
};

export type DumdictVaultStoreOptions = {
	readonly vault: DictionaryVault;
	/** A `(path, mtime)` cache that lets startup skip unchanged notes. */
	readonly cache?: DictionaryNoteCache;
	/**
	 * Projection Blocks the codec renders into every note the store writes.
	 * The store fills the `inverse_relation` Block itself, from the claims
	 * that target each note (#59).
	 */
	readonly projections?: Omit<Projections<"de">, "inverseRelations">;
	/** Called after the index is built or changes, with the current diagnostics. */
	readonly onDiagnostics?: (diagnostics: DictionaryDiagnostics) => void;
};

/**
 * dumdict's host over the vault: one note per Lemma under `Worter/`, at its
 * identity path (ADR 0013). Reads come from an immutable version of an
 * in-memory index kept current through VAM's events; commits are
 * serialized, checked against a staged fork of the index, and written as
 * one stop-on-first-failure batch. The store never overwrites or removes
 * content it did not write: creates fail on an existing file, rewrites
 * compare-and-swap on the content they read, and only the store's own
 * Shadow bodies are ever trashed.
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
	/**
	 * Applies a plan all-or-nothing against its base revision. Every note
	 * it writes shows the inverse relations of the committed state. Once the
	 * commit landed, each other note its claims reach whose file shows other
	 * inverse relations is re-rendered; that step never fails the commit.
	 * No relation is ever written into a note but its source's.
	 * A conflict writes nothing. A failure before dispatch writes nothing; a
	 * `DictionaryWriteError` means the batch stopped after some writes
	 * landed, and the index was rebuilt from the files.
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
	/** A Lemma's note path and records, if it is stored. */
	readonly lemmaNote: (lemma: Dumling.Lemma<"de">) => Effect.Effect<
		| {
				readonly path: string;
				readonly readings: readonly ReadingEntry<"de">[];
				readonly ownedSurfaces: readonly SurfaceEntry<"de">[];
				readonly pendingRelations: readonly PendingSemanticRelationRecord<"de">[];
		  }
		| undefined
	>;
	/** Every stored Lemma and the path of the note that holds it, by path. */
	readonly lemmaNotes: Effect.Effect<
		readonly {
			readonly path: string;
			readonly lemma: Dumling.Lemma<"de">;
		}[]
	>;
	/** Where a Reading lives: its note path and Block ID, for links. */
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
	 * Places user text as a freeform Block at the end of one Reading's part
	 * of a stored Lemma note, or of its Lemma part when `readingBlockId`
	 * names no Reading there. It changes no record, writes only through a
	 * compare-and-swap on the content it read, and answers `AlreadyThere`
	 * when the note already holds the text as a freeform Block.
	 */
	readonly appendFreeform: (request: {
		readonly path: string;
		readonly readingBlockId?: string;
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

/** Record lists compared without order, as canonical JSON. */
function sameData(left: NoteData, right: NoteData): boolean {
	const lists = (data: NoteData) =>
		[
			[data.lemmaRecord],
			data.readingEntries,
			data.ownedSurfaceEntries,
			data.pendingRelations,
		].map((list) => list.map((value) => canonicalJson(value)).sort());
	return canonicalJson(lists(left)) === canonicalJson(lists(right));
}

/** A rewrite that lands only on the content it was planned from. */
function compareAndSwap(path: string, expected: string, next: string) {
	return (onDisk: string) => {
		if (onDisk !== expected)
			throw new Error(`${path} changed after the store read it`);
		return next;
	};
}

let sessionCounter = 0;

/**
 * Builds the store: subscribes to VAM's events, builds the index from a
 * scan of `Worter/`, and heals notes whose path disagrees with their
 * metadata. VAM's `startListening` stays with the plugin.
 */
export const makeDumdictVaultStore = Effect.fnUntraced(function* (
	options: DumdictVaultStoreOptions,
): Effect.fn.Return<DumdictVaultStore, DictionaryScanError> {
	const { vault, cache, projections } = options;
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
		const userShadows: string[] = [];
		for (const entry of view.allEntries()) {
			if (entry.kind === "quarantined")
				quarantined.push({ path: entry.path, reason: entry.reason });
			if (
				entry.kind === "shadow" &&
				!entry.owned &&
				view.shadowClaims(entry.path).size === 0
			)
				userShadows.push(entry.path);
		}
		for (const { path, heldBy } of view.duplicates())
			quarantined.push({
				path,
				reason: { _tag: "DuplicateLemma", heldBy },
			});
		quarantined.sort((a, b) => byCodeUnit(a.path, b.path));
		return {
			healingBlocked,
			quarantined,
			scanIssues,
			userShadows: userShadows.sort(byCodeUnit),
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

	/**
	 * Whether the index has seen every file whole: no stale index, no scan
	 * issue and no quarantined note, any of which could hide a pending
	 * relation. Only then may the store remove a Shadow no relation claims.
	 */
	const complete = () =>
		!stale &&
		scanIssues.length === 0 &&
		index.allEntries().every((entry) => entry.kind !== "quarantined");

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
		const entry = classifyNote(path, read.success.content);
		const cached = toCached(entry, read.success.stat);
		if (cached) cache?.set(path, cached);
		return entry;
	});

	/**
	 * Re-reads paths from the files and publishes what changed as one new
	 * index version. A path whose content hash matches what was indexed,
	 * such as an echo of the store's own write, changes nothing.
	 */
	const rereadChanges = Effect.fnUntraced(function* (
		paths: Iterable<string>,
	) {
		const changes: {
			path: string;
			before: PathEntry | undefined;
			entry: PathEntry | undefined;
		}[] = [];
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
	const reread = (paths: Iterable<string>) =>
		rereadChanges(paths).pipe(Effect.map((changes) => changes.length > 0));

	/**
	 * The Lemmas whose inverse relations these file changes can move: every
	 * Lemma a changed note claimed a relation on, before or after, other
	 * than the changed notes' own, which are left to their editor.
	 */
	const claimsMovedBy = (
		changes: readonly {
			readonly before: PathEntry | undefined;
			readonly entry: PathEntry | undefined;
		}[],
	): Set<string> => {
		const notes = changes
			.flatMap(({ before, entry }) => [before, entry])
			.filter((entry) => entry?.kind === "lemma");
		return claimedBy(
			notes.map(({ data }) => data),
			new Set(notes.map(({ lemmaKey }) => lemmaKey)),
		);
	};

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
							const note = classifyNote(path, content);
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
	 * The store's own Shadow notes among `paths`, read now: only a file that
	 * holds exactly the store's Shadow body may be trashed.
	 */
	const ownedShadowContents = Effect.fnUntraced(function* (
		paths: readonly string[],
	) {
		const owned: { path: string; content: string }[] = [];
		for (const path of paths) {
			const read = yield* Effect.result(
				vault.readContentWithStat(mdSplitPath(path)),
			);
			if (
				read._tag === "Success" &&
				isStoreShadow(path, read.success.content)
			)
				owned.push({ content: read.success.content, path });
		}
		return owned;
	});

	/** An identity rewrite that fails the batch if the Shadow's content changed. */
	const verifyShadow = ({
		path,
		content,
	}: {
		path: string;
		content: string;
	}): VaultAction => ({
		kind: VaultActionKind.ProcessMdFile,
		payload: {
			splitPath: mdSplitPath(path),
			transform: compareAndSwap(path, content, content),
		},
	});

	/**
	 * Trashes Shadow notes already verified as the store's own. VAM lets a
	 * trash win over any other action on its path, so the verification runs
	 * in the batch before; the files are re-read afterwards either way. VAM
	 * has no conditional trash, so an edit landing between the two batches
	 * is lost to Obsidian's trash, where it can still be restored.
	 */
	const trashVerified = Effect.fnUntraced(function* (
		paths: readonly string[],
	) {
		if (paths.length === 0) return;
		const outcome = yield* Effect.result(
			dispatch(
				paths.map(
					(path): VaultAction => ({
						kind: VaultActionKind.TrashMdFile,
						payload: { splitPath: mdSplitPath(path) },
					}),
				),
			),
		);
		if (outcome._tag === "Failure")
			yield* Effect.logWarning(
				"Dictionary could not remove Shadow notes",
				outcome.failure,
			);
		yield* reread(paths);
	});

	/**
	 * Removes the store's own Shadow notes that no relation needs any more.
	 * It runs only after a full read of `Worter/` that saw every file whole,
	 * so a note it could not read never loses its Shadow.
	 */
	const cleanOrphanShadows = Effect.fnUntraced(function* () {
		if (!complete()) return;
		const orphans = yield* ownedShadowContents(index.orphanShadows());
		if (orphans.length === 0) return;
		const verified = yield* Effect.result(
			dispatch(orphans.map(verifyShadow)),
		);
		if (verified._tag === "Failure") {
			yield* reread(orphans.map(({ path }) => path));
			return;
		}
		yield* trashVerified(orphans.map(({ path }) => path));
	});

	/**
	 * Moves Lemma notes whose path disagrees with their metadata to their
	 * canonical path, unless a file is already there. The index learns the
	 * outcome from the files, not from what the move was meant to do; a move
	 * that fails or lands elsewhere rebuilds the index and heals once more.
	 */
	const heal = Effect.fnUntraced(function* (
		retry = true,
	): Effect.fn.Return<void> {
		const blocked: HealingBlocked[] = [];
		const moves: { from: string; to: string; lemmaKey: string }[] = [];
		for (const { from, to } of index.misplaced()) {
			if (to === undefined) {
				blocked.push({
					canonicalPath: undefined,
					message: "Its Lemma has no path the slot table can spell",
					path: from,
				});
				continue;
			}
			const moving = index.entry(from);
			if (moving?.kind !== "lemma") continue;
			if (failedMoves.get(moveKey(from, to)) === moving.hash) {
				blocked.push({
					canonicalPath: to,
					message:
						"Moving it to its canonical path failed; the store tries again once the note changes",
					path: from,
				});
				continue;
			}
			const occupied =
				index.sameFileAs(to).length > 0 ||
				(yield* vault
					.exists(mdSplitPath(to))
					.pipe(Effect.orElseSucceed(() => true)));
			if (occupied)
				blocked.push({
					canonicalPath: to,
					message:
						"Another file sits at its canonical path; the two may be duplicates",
					path: from,
				});
			else moves.push({ from, lemmaKey: moving.lemmaKey, to });
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
		yield* reread(moves.flatMap(({ from, to }) => [from, to]));
		// A move that failed or landed elsewhere, such as VAM renaming it
		// aside on a collision, is found by reading everything again; it is
		// not tried again until its note changes.
		const landed = ({ lemmaKey, to }: (typeof moves)[number]) => {
			const entry = index.entry(to);
			return entry?.kind === "lemma" && entry.lemmaKey === lemmaKey;
		};
		if (outcome._tag === "Success" && moves.every(landed)) return;
		const rebuilt = yield* recover;
		for (const move of moves) {
			const left = index.entry(move.from);
			if (!landed(move) && left?.kind === "lemma")
				failedMoves.set(moveKey(move.from, move.to), left.hash);
		}
		if (rebuilt && retry) return yield* heal(false);
	});

	/** After a full read of `Worter/`: heal, then remove orphan Shadows. */
	const settle = heal().pipe(Effect.andThen(cleanOrphanShadows()));

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
		const changes = yield* rereadChanges(targets);
		if (changes.length === 0) return false;
		yield* heal();
		// Claims changed by hand, deletion or Sync reach other notes too.
		yield* rerenderInverse(claimsMovedBy(changes));
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

	/** A conflict that reports the revision the caller should re-plan at. */
	const conflict = (
		code: "revisionConflict" | "semanticPreconditionFailed",
	): CommitChangesResult => ({
		code,
		latestRevision: revision(),
		status: "conflict",
	});

	type PlannedWrite = {
		readonly path: string;
		readonly entry: LemmaNoteEntry;
		readonly action: VaultAction;
		/** The content the write leaves, and the content it replaces, if any. */
		readonly content: string;
		readonly current: string | undefined;
	};

	/**
	 * Serializes one staged note. `Stale` means the index was behind the
	 * files for this note: the caller re-reads and reports a revision
	 * conflict, so the caller re-plans over what is really there.
	 */
	const planNoteWrite = Effect.fnUntraced(function* (
		note: StagedNote,
		noteProjections: Projections<"de">,
	): Effect.fn.Return<
		PlannedWrite | { readonly _tag: "Stale"; readonly path: string },
		| DictionaryPathOccupiedError
		| DictionaryRoundTripError
		| DictionaryRequestError
	> {
		const lemma = note.data.lemmaRecord.lemma;
		const data: NoteData = note.data;
		const write = (path: string, current: string | undefined) =>
			Effect.try({
				catch: (cause) =>
					new DictionaryRoundTripError({
						message:
							cause instanceof LemmaNoteSerializeError
								? `The note cannot hold these records: ${cause.message}`
								: message(cause),
						path,
					}),
				try: () => {
					const document =
						current === undefined
							? undefined
							: parse(current, { language: "de" }).document;
					const content = serialize(document, data, {
						projections: noteProjections,
					});
					const entry = classifyNote(path, content);
					if (
						entry.kind !== "lemma" ||
						entry.lemmaKey !== note.lemmaKey
					)
						throw new Error(
							"The written note does not parse back as its Lemma",
						);
					if (!sameData(entry.data, data))
						throw new Error(
							"The written note does not parse back to its records",
						);
					return { content, entry };
				},
			});

		if (note.basePath !== undefined) {
			const path = note.basePath;
			const read = yield* Effect.result(
				vault.readContentWithStat(mdSplitPath(path)),
			);
			const indexed = index.entry(path);
			if (
				read._tag === "Failure" ||
				indexed === undefined ||
				contentHash(read.success.content) !== indexed.hash
			)
				return { _tag: "Stale", path } as const;
			const current = read.success.content;
			const { content, entry } = yield* write(path, current);
			return {
				action: {
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						splitPath: mdSplitPath(path),
						transform: compareAndSwap(path, current, content),
					},
				},
				content,
				current,
				entry,
				path,
			};
		}

		const path = canonicalLemmaPath(lemma);
		if (path === undefined)
			return yield* new DictionaryRequestError({
				cause: lemma,
				message: "The Lemma has no note path the slot table can spell",
			});
		// A case variant of the path is the same file on macOS and Windows.
		const [occupiedAt] = index.sameFileAs(path);
		const occupant =
			occupiedAt === undefined ? undefined : index.entry(occupiedAt);
		if (occupant !== undefined)
			return yield* new DictionaryPathOccupiedError({
				message: `${path} holds a ${occupant.kind === "lemma" ? "note of another Lemma" : `${occupant.kind} note`}; the store will not overwrite it`,
				path,
			});
		const present = yield* vault
			.exists(mdSplitPath(path))
			.pipe(Effect.orElseSucceed(() => true));
		if (present) return { _tag: "Stale", path } as const;
		const { content, entry } = yield* write(path, undefined);
		return {
			action: {
				kind: VaultActionKind.CreateFile,
				payload: { content, splitPath: createOnlySplitPath(path) },
			},
			content,
			current: undefined,
			entry,
			path,
		};
	});

	/**
	 * Shadow notes to create and to remove. Every file's pending relations
	 * count, holders, duplicates and quarantined notes alike. A Shadow with a
	 * relation and no file is (re)created; one whose last relation goes is a
	 * candidate for removal, verified as the store's own at dispatch.
	 */
	const planShadows = (
		notes: readonly StagedNote[],
		writes: ReadonlyMap<string, string>,
	) => {
		const removed = new Map<string, Set<string>>();
		const added = new Map<string, Set<string>>();
		const samples = new Map<string, PendingSemanticRelationRecord<"de">>();
		const note = (
			map: Map<string, Set<string>>,
			path: string,
			ref: string,
		) => map.set(path, (map.get(path) ?? new Set()).add(ref));
		for (const staged of notes) {
			const notePath = staged.basePath ?? writes.get(staged.lemmaKey);
			if (notePath === undefined) continue;
			if (staged.basePath !== undefined)
				for (const record of staged.base?.pendingRelations ?? []) {
					const path = shadowPathOf(record);
					if (path)
						note(
							removed,
							path,
							shadowRefOf(staged.basePath, record),
						);
				}
			for (const record of staged.data.pendingRelations) {
				const path = shadowPathOf(record);
				if (!path) continue;
				note(added, path, shadowRefOf(notePath, record));
				samples.set(path, record);
			}
		}
		const creates: { path: string; content: string }[] = [];
		const removals: string[] = [];
		for (const path of new Set([...removed.keys(), ...added.keys()])) {
			const before = index.shadowClaims(path);
			const after = new Set(
				[...before].filter((ref) => !removed.get(path)?.has(ref)),
			);
			for (const ref of added.get(path) ?? []) after.add(ref);
			// Claims and files are matched without case, as the file system does.
			const occupants = index.sameFileAs(path);
			const sample = samples.get(path);
			if (after.size > 0 && occupants.length === 0 && sample)
				creates.push({
					content: shadowBody(sample.pending.target),
					path,
				});
			if (before.size > 0 && after.size === 0 && complete())
				for (const occupant of occupants)
					if (index.entry(occupant)?.kind === "shadow")
						removals.push(occupant);
		}
		return { creates, removals };
	};

	/**
	 * The index with a commit's staged notes in place, for rendering only:
	 * it is never published, and a new note sits at its canonical path.
	 */
	const previewOf = (notes: readonly StagedNote[]): NoteIndex => {
		const preview = index.clone();
		for (const note of notes) {
			const path =
				note.basePath ??
				canonicalLemmaPath(note.data.lemmaRecord.lemma);
			if (path !== undefined)
				preview.set(path, lemmaEntry(path, "", note.data));
		}
		return preview;
	};

	/**
	 * Re-renders the `inverse_relation` Blocks of these Lemmas' notes from
	 * the published index (#59), under the writer lock its caller holds. A
	 * note is rewritten only when its file shows other inverse relations
	 * than the index gives, as one compare-and-swap on the content the store
	 * indexed, so user text is never overwritten. A note whose file is ahead
	 * of the index, or whose write loses a race, is re-read and tried again,
	 * with the notes its changed claims reach, for at most three rounds.
	 * Re-renders keep the revision. It never fails: a note it cannot
	 * re-render keeps its Block until the next re-render.
	 */
	const rerenderInverse = Effect.fnUntraced(function* (
		lemmaKeys: ReadonlySet<string>,
	) {
		let pending = [...lemmaKeys].sort(byCodeUnit);
		for (let round = 0; round < 3 && pending.length > 0; round += 1) {
			const reader = inverseRelationsReader(index);
			const noteProjections = withInverseRelations(
				projections,
				reader.read,
			);
			const writes: PlannedWrite[] = [];
			const retry = new Set<string>();
			const stalePaths: string[] = [];
			for (const lemmaKey of pending) {
				const held = index.lemmaNote(lemmaKey);
				if (!held) continue;
				if (reader.read(lemmaKey) === undefined) {
					yield* Effect.logWarning(
						"Dictionary could not project a note's inverse relations",
						held.path,
					);
					continue;
				}
				const planned = yield* Effect.result(
					planNoteWrite(
						{
							base: held.data,
							basePath: held.path,
							data: {
								lemmaRecord: held.data.lemmaRecord,
								ownedSurfaceEntries: [
									...held.data.ownedSurfaceEntries,
								],
								pendingRelations: [
									...held.data.pendingRelations,
								],
								readingEntries: [...held.data.readingEntries],
							},
							lemmaKey,
						},
						noteProjections,
					),
				);
				if (planned._tag === "Failure") {
					yield* Effect.logWarning(
						"Dictionary could not re-render a note's inverse relations",
						planned.failure,
					);
					continue;
				}
				const write = planned.success;
				if ("_tag" in write) {
					stalePaths.push(write.path);
					retry.add(lemmaKey);
				} else if (
					write.current !== undefined &&
					showsOtherInverseRelations(write.current, write.content)
				)
					writes.push(write);
			}
			// A file ahead of the index holds an edit no event has delivered
			// yet; the notes its claims reach are re-rendered with it.
			if (stalePaths.length > 0)
				for (const key of claimsMovedBy(
					yield* rereadChanges(stalePaths),
				))
					retry.add(key);
			if (writes.length > 0) {
				const outcome = yield* Effect.result(
					dispatch(writes.map(({ action }) => action)),
				);
				if (outcome._tag === "Success") {
					const next = index.clone();
					for (const { path, entry } of writes) {
						next.set(path, entry);
						cache?.delete(path);
					}
					publishRendering(next);
				} else {
					yield* Effect.logWarning(
						"Dictionary inverse-relation re-renders stopped; re-reading the notes",
						outcome.failure,
					);
					const changes = yield* rereadChanges(
						writes.map(({ path }) => path),
					);
					for (const key of claimsMovedBy(changes)) retry.add(key);
					for (const { entry } of writes) retry.add(entry.lemmaKey);
				}
			}
			pending = [...retry].sort(byCodeUnit);
		}
	});

	/**
	 * The Lemmas these notes' Readings claim a relation on, other than the
	 * notes' own: the notes whose inverse relations a change to them can move.
	 */
	const claimedBy = (
		notes: Iterable<
			| { readonly readingEntries: readonly ReadingEntry<"de">[] }
			| undefined
		>,
		own: ReadonlySet<string>,
	): Set<string> => {
		const claimed = new Set<string>();
		for (const data of notes)
			for (const entry of data?.readingEntries ?? [])
				for (const { targetLemmaKey } of relationEdgesOf(entry))
					if (!own.has(targetLemmaKey)) claimed.add(targetLemmaKey);
		return claimed;
	};

	const commitUnderLock = Effect.fnUntraced(function* (
		request: CommitChangesRequest<"de"> | DumdictPlan<"de">,
	): Effect.fn.Return<CommitChangesResult, DictionaryCommitError> {
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
				new DictionaryRequestError({ cause, message: message(cause) }),
			try: () => stageChanges(index, revision(), parsed.changes),
		});
		if (staged._tag === "PreconditionFailed")
			return conflict("semanticPreconditionFailed");
		if (staged.notes.length === 0)
			return { nextRevision: revision(), status: "committed" };

		// The index as it will read once the commit lands: every note is
		// rendered with the inverse relations of that state.
		const inverseAfter = inverseRelationsReader(previewOf(staged.notes));
		const noteProjections = withInverseRelations(
			projections,
			inverseAfter.read,
		);

		const writes: PlannedWrite[] = [];
		const stalePaths: string[] = [];
		for (const note of staged.notes) {
			const planned = yield* planNoteWrite(note, noteProjections);
			if ("_tag" in planned) stalePaths.push(planned.path);
			else writes.push(planned);
		}
		const writePaths = new Map(
			writes.map(({ entry, path }) => [entry.lemmaKey, path]),
		);
		const shadows = planShadows(staged.notes, writePaths);
		if (inverseAfter.failed.size > 0)
			yield* Effect.logWarning(
				"Dictionary could not project inverse relations for some notes it writes",
				[...inverseAfter.failed],
			);
		for (const { path } of shadows.creates) {
			const present = yield* vault
				.exists(mdSplitPath(path))
				.pipe(Effect.orElseSucceed(() => true));
			if (present) stalePaths.push(path);
		}
		if (stalePaths.length > 0) {
			// A refresh that finds nothing new still refuses: the plan read a
			// state the files no longer hold.
			const changes = yield* rereadChanges(stalePaths);
			if (changes.length === 0) publish(index.clone());
			yield* rerenderInverse(claimsMovedBy(changes));
			return conflict("revisionConflict");
		}
		const removals = yield* ownedShadowContents(shadows.removals);
		const verifiedPaths = new Set(removals.map(({ path }) => path));

		// Creates run as their own first batch: VAM orders a batch by folder
		// depth, so only then does a create that finds a file stop the commit
		// before any rewrite lands.
		const isCreate = ({ action }: PlannedWrite) =>
			action.kind === VaultActionKind.CreateFile;
		const creates: VaultAction[] = [
			...writes.filter(isCreate).map(({ action }) => action),
			...shadows.creates.map(
				({ path, content }): VaultAction => ({
					kind: VaultActionKind.CreateFile,
					payload: { content, splitPath: createOnlySplitPath(path) },
				}),
			),
		];
		const rewrites: VaultAction[] = [
			...writes
				.filter((write) => !isCreate(write))
				.map(({ action }) => action),
			...removals.map(verifyShadow),
		];
		const wrote = (action: VaultAction) =>
			action.kind !== VaultActionKind.CreateFolder &&
			!(
				action.kind === VaultActionKind.ProcessMdFile &&
				verifiedPaths.has(actionPath(action))
			);

		const phases = [creates, rewrites];
		const done: VaultAction[] = [];
		for (const [phase, actions] of phases.entries()) {
			if (actions.length === 0) continue;
			const outcome = yield* Effect.result(dispatch(actions));
			if (outcome._tag === "Success") {
				done.push(...actions);
				continue;
			}
			const landedBefore = done.some(wrote);
			const later = phases.slice(phase + 1).flat();
			const failure = outcome.failure;
			const stopped = failure instanceof VamDispatchStoppedError;
			const executed = stopped ? failure.executed : [];
			// VAM fails planning and overflow before it runs any action.
			const ranNothing =
				!stopped &&
				(failure._tag === "VamPlanningError" ||
					failure._tag === "VamDispatchOverflowError");
			const landed =
				landedBefore ||
				executed.some(wrote) ||
				!(stopped || ranNothing);
			const rebuilt = yield* recover;
			if (!landed) return conflict("revisionConflict");
			return yield* new DictionaryWriteError({
				cause: failure,
				executed: [...done, ...executed].map(actionPath),
				message: `The commit's writes stopped: ${message(stopped ? failure.failure.cause : failure)}. The index was ${rebuilt ? "rebuilt from the files" : "not rebuilt; the next operation retries"}.`,
				rebuilt,
				skipped: [...(stopped ? failure.skipped : []), ...later].map(
					actionPath,
				),
			});
		}

		const next = index.clone();
		for (const { path, entry } of writes) {
			next.set(path, entry);
			cache?.delete(path);
		}
		for (const { path, content } of shadows.creates) {
			next.set(path, {
				hash: contentHash(content),
				kind: "shadow",
				owned: true,
				path,
			});
			cache?.delete(path);
		}
		publish(next);
		yield* trashVerified([...verifiedPaths]);
		const committed = revision();
		// The notes this commit's claims reach, before or after, show the
		// committed claims. Their re-renders change no data, so they run
		// after the commit landed, never fail it and keep its revision; an
		// edit they find on disk moves the revision past it.
		const written = new Set(staged.notes.map(({ lemmaKey }) => lemmaKey));
		yield* rerenderInverse(
			claimedBy(
				staged.notes.flatMap((note) => [note.base, note.data]),
				written,
			),
		);
		return { nextRevision: committed, status: "committed" };
	});

	/** How often a freeform placement reads the note again after it changed. */
	const FREEFORM_ATTEMPTS = 3;

	const appendFreeformUnderLock = Effect.fnUntraced(function* (request: {
		readonly path: string;
		readonly readingBlockId?: string;
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
		for (let attempt = 1; ; attempt += 1) {
			const indexed = index.entry(path);
			if (indexed?.kind !== "lemma")
				return yield* refuse("the store holds no Lemma note there");
			const read = yield* Effect.result(
				vault.readContentWithStat(mdSplitPath(path)),
			);
			if (read._tag === "Failure")
				return yield* refuse(message(read.failure), read.failure);
			const current = read.success.content;
			if (contentHash(current) !== indexed.hash) {
				// The file is ahead of the index: an edit no event has
				// delivered yet. Read it and place the text into that.
				yield* rereadChanges([path]);
				if (attempt < FREEFORM_ATTEMPTS) continue;
				return yield* refuse(
					"the note kept changing while the store read it",
				);
			}
			const placed = insertFreeformBlock(
				current,
				request.readingBlockId,
				request.text,
			);
			if (placed._tag === "AlreadyThere") return "AlreadyThere";
			if (placed._tag === "Refused") return yield* refuse(placed.reason);
			const entry = classifyNote(path, placed.content);
			if (
				entry.kind !== "lemma" ||
				entry.lemmaKey !== indexed.lemmaKey ||
				!sameData(entry.data, indexed.data) ||
				!holdsFreeformBlock(placed.content, request.text)
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
								current,
								placed.content,
							),
						},
					},
				]),
			);
			if (outcome._tag === "Success") {
				// No record changed, so plans made at this revision stay valid.
				const next = index.clone();
				next.set(path, entry);
				cache?.delete(path);
				publishRendering(next);
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
			Effect.sync(() => {
				const view = index;
				return loadCleanupRelationsContext(view, revision(), request);
			}),
		loadReadingEntryContext: (request) =>
			Effect.try({
				catch: (cause) =>
					new DictionaryRequestError({
						cause,
						message: message(cause),
					}),
				try: () => loadReadingEntryContext(index, revision(), request),
			}),
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
