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
import { formKeyOf, lemmaKeyOf, locatorKeyOf, readingKeyOf } from "./keys";
import { type DictionaryNoteCache, fromCached, toCached } from "./note-cache";
import {
	classifyNote,
	type LemmaNoteEntry,
	type NoteData,
	type PathEntry,
	type QuarantineReason,
	sameEntry,
	unreadableEntry,
} from "./note-entry";
import {
	canonicalLemmaPath,
	NoteIndex,
	type ReadingLocation,
	type RelationEdge,
	shadowPathOf,
} from "./note-index";
import { loadCleanupRelationsContext, loadReadingEntryContext } from "./slices";
import { type StagedNote, stageChanges } from "./stage-changes";
import {
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
	/** Folders or files the last full scan could not read. */
	readonly scanIssues: readonly string[];
};

export type DumdictVaultStoreOptions = {
	readonly vault: DictionaryVault;
	/** A `(path, mtime)` cache that lets startup skip unchanged notes. */
	readonly cache?: DictionaryNoteCache;
	/** Projection Blocks the codec renders into every note the store writes. */
	readonly projections?: Projections<"de">;
	/** Called after the index is built or changes, with the current diagnostics. */
	readonly onDiagnostics?: (diagnostics: DictionaryDiagnostics) => void;
};

/**
 * dumdict's host over the vault: one note per Lemma under `Worter/`, at its
 * identity path (ADR 0013). Reads come from an in-memory index kept current
 * through VAM's events; commits are serialized, checked against a staged
 * fork of the index, and written as one stop-on-first-failure batch.
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
	 * Applies a plan all-or-nothing against its base revision. A conflict
	 * writes nothing. A failure before dispatch writes nothing; a
	 * `DictionaryWriteError` means the batch stopped part-way and the index
	 * was rebuilt from the files.
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
	/** A Lemma's note path and its Reading Entries, if it is stored. */
	readonly lemmaNote: (lemma: Dumling.Lemma<"de">) => Effect.Effect<
		| {
				readonly path: string;
				readonly readings: readonly ReadingEntry<"de">[];
				readonly ownedSurfaces: readonly SurfaceEntry<"de">[];
				readonly pendingRelations: readonly PendingSemanticRelationRecord<"de">[];
		  }
		| undefined
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
	/** Stops observing the vault. */
	readonly close: Effect.Effect<void>;
};

const SHADOW_BODY = (record: PendingSemanticRelationRecord<"de">): string => {
	const { canonicalForm, family, kind } = record.pending.target;
	return `${canonicalForm}\n\nA Shadow note: a Semantic Relation names this ${family} ${kind}, which has no Lemma note yet.\n`;
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
	const index = new NoteIndex();
	sessionCounter += 1;
	const session = `${Date.now().toString(36)}${sessionCounter.toString(36)}`;
	let counter = 0;
	let stale = false;
	let healingBlocked: HealingBlocked[] = [];
	let scanIssues: string[] = [];
	let lastDiagnostics = "";

	const revision = (): StoreRevision => `vault:${session}:${counter}`;
	const bump = () => {
		counter += 1;
	};

	const diagnosticsNow = (): DictionaryDiagnostics => {
		const quarantined: QuarantinedNote[] = [];
		for (const entry of index.allEntries())
			if (entry.kind === "quarantined")
				quarantined.push({ path: entry.path, reason: entry.reason });
		for (const { path, heldBy } of index.duplicates())
			quarantined.push({
				path,
				reason: { _tag: "DuplicateLemma", heldBy },
			});
		quarantined.sort((a, b) => (a.path < b.path ? -1 : 1));
		return { healingBlocked, quarantined, scanIssues };
	};

	const report = Effect.sync(() => {
		if (!options.onDiagnostics) return;
		const diagnostics = diagnosticsNow();
		const fingerprint = JSON.stringify(diagnostics);
		if (fingerprint === lastDiagnostics) return;
		lastDiagnostics = fingerprint;
		options.onDiagnostics(diagnostics);
	});

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

	/** Rebuilds the index from a full scan of `Worter/`. Holds no lock itself. */
	const rebuild = Effect.fnUntraced(function* () {
		const present = yield* vault.exists(WORTER_SPLIT_PATH).pipe(
			Effect.mapError(
				(cause) =>
					new DictionaryScanError({
						cause,
						message: `Could not check for ${WORTER_SPLIT_PATH.basename}/: ${message(cause)}`,
					}),
			),
		);
		const entries: PathEntry[] = [];
		let issues: string[] = [];
		if (present) {
			const scan = yield* vault.scanWithStat(WORTER_SPLIT_PATH).pipe(
				Effect.mapError(
					(cause) =>
						new DictionaryScanError({
							cause,
							message: `Could not scan ${WORTER_SPLIT_PATH.basename}/: ${message(cause)}`,
						}),
				),
			);
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
					if (
						cached &&
						cached.mtime === entry.stat.mtime &&
						cached.size === entry.stat.size
					)
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
			for (const note of notes) if (note) entries.push(note);
		}
		index.clear();
		for (const entry of entries) index.set(entry.path, entry);
		scanIssues = issues;
		stale = false;
		bump();
	});

	/** Rebuilds after a write whose outcome is uncertain; never fails. */
	const recover = rebuild().pipe(
		Effect.as(true),
		Effect.catch((error) =>
			Effect.logError("Dictionary index rebuild failed", error).pipe(
				Effect.andThen(
					Effect.sync(() => {
						stale = true;
						bump();
						return false;
					}),
				),
			),
		),
	);

	/**
	 * Moves Lemma notes whose path disagrees with their metadata to their
	 * canonical path. A failed move rebuilds the index and is not retried
	 * until the next change.
	 */
	const heal = Effect.fnUntraced(function* () {
		const blocked: HealingBlocked[] = [];
		const moves: { from: string; to: string; entry: LemmaNoteEntry }[] = [];
		for (const { from, to } of index.misplaced()) {
			const entry = index.entry(from);
			if (entry?.kind !== "lemma") continue;
			if (to === undefined)
				blocked.push({
					canonicalPath: undefined,
					message: "Its Lemma has no path the slot table can spell",
					path: from,
				});
			else if (index.entry(to) !== undefined)
				blocked.push({
					canonicalPath: to,
					message: "Another note sits at its canonical path",
					path: from,
				});
			else moves.push({ entry, from, to });
		}
		healingBlocked = blocked;
		if (moves.length === 0) return;
		const actions: VaultAction[] = moves.map(({ from, to }) => ({
			kind: VaultActionKind.RenameMdFile,
			payload: { from: mdSplitPath(from), to: mdSplitPath(to) },
		}));
		const outcome = yield* Effect.result(
			vault.dispatchStopOnFirstFailure(actions),
		);
		if (outcome._tag === "Failure") {
			yield* Effect.logWarning(
				"Dictionary healing stopped; rebuilding the index",
				outcome.failure,
			);
			yield* recover;
			return;
		}
		for (const { entry, from, to } of moves) {
			index.set(from, undefined);
			index.set(to, { ...entry, path: to });
			cache?.delete(from);
		}
		bump();
	});

	/**
	 * Re-reads paths after an event and reflects them in the index. Identity
	 * comes from content, never event order; a path whose content hash
	 * matches what was indexed, such as an echo of the store's own write, is
	 * a no-op that leaves the revision alone.
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
				.pipe(Effect.orElseSucceed(() => false));
			if (!present) continue;
			const scan = yield* Effect.result(vault.scanWithStat(splitPath));
			if (scan._tag === "Failure") {
				stale = true;
				continue;
			}
			for (const entry of scan.success.entries)
				if (entry.kind === "MdFile") targets.add(formatPath(entry));
		}
		let changed = false;
		for (const path of targets) {
			const next = yield* readEntry(path);
			if (sameEntry(index.entry(path), next)) continue;
			index.set(path, next);
			changed = true;
		}
		if (!changed) return false;
		bump();
		yield* heal();
		return true;
	});

	const guarded = <E>(label: string, effect: Effect.Effect<unknown, E>) =>
		lock
			.withPermit(
				Effect.gen(function* () {
					if (stale) yield* recover;
					yield* effect;
					yield* report;
				}),
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
		const relevant =
			paths.some(inScope) ||
			folders.some(
				(folder) =>
					inScope(`${folder}/`) ||
					isUnder(WORTER_SPLIT_PATH.basename, folder),
			);
		if (!relevant) return Effect.void;
		// A folder above `Worter/` moved or vanished: re-read everything.
		const whole = folders.some(
			(folder) =>
				!inScope(`${folder}/`) &&
				isUnder(WORTER_SPLIT_PATH.basename, folder),
		);
		return guarded(
			"event handling",
			whole
				? rebuild().pipe(Effect.andThen(heal()))
				: refresh(
						paths,
						folders.filter((folder) => inScope(`${folder}/`)),
					),
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

	const bulkSubscription = yield* vault.subscribeToBulk(onBulk).pipe(
		Effect.mapError(
			(cause) =>
				new DictionaryScanError({
					cause,
					message: `Could not observe the vault: ${message(cause)}`,
				}),
		),
	);
	const modifySubscription = yield* vault
		.subscribeToMdModifications(WORTER_SPLIT_PATH, onModify)
		.pipe(
			Effect.mapError(
				(cause) =>
					new DictionaryScanError({
						cause,
						message: `Could not observe note edits: ${message(cause)}`,
					}),
			),
		);
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
				yield* heal();
				yield* report;
			}),
		)
		.pipe(Effect.onError(() => close));

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
	};

	/**
	 * Serializes one staged note. Undefined means the index was stale for
	 * this note: the caller refreshes and reports a revision conflict.
	 */
	const planNoteWrite = Effect.fnUntraced(function* (
		note: StagedNote,
	): Effect.fn.Return<
		PlannedWrite | { readonly _tag: "Stale"; readonly path: string },
		| DictionaryPathOccupiedError
		| DictionaryRoundTripError
		| DictionaryRequestError
	> {
		const lemma = note.data.lemmaRecord.lemma;
		const data: NoteData = note.data;
		const write = (
			path: string,
			current: string | undefined,
		): Effect.Effect<
			{ readonly content: string; readonly entry: LemmaNoteEntry },
			DictionaryRoundTripError
		> =>
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
					const content = serialize(document, data, { projections });
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
			// A compare-and-swap: the write lands only on the content just read.
			const transform = (onDisk: string) => {
				if (onDisk !== current)
					throw new Error(`${path} changed after the commit read it`);
				return content;
			};
			return {
				action: {
					kind: VaultActionKind.ProcessMdFile,
					payload: { splitPath: mdSplitPath(path), transform },
				},
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
		const occupant = index.entry(path);
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
				kind: VaultActionKind.UpsertMdFile,
				payload: { content, splitPath: mdSplitPath(path) },
			},
			entry,
			path,
		};
	});

	/** Shadow notes to create and remove as pending relations come and go. */
	const planShadows = (notes: readonly StagedNote[]) => {
		const delta = new Map<
			string,
			{
				added: Set<string>;
				removed: Set<string>;
				sample?: PendingSemanticRelationRecord<"de">;
			}
		>();
		const at = (path: string) => {
			const found = delta.get(path) ?? {
				added: new Set(),
				removed: new Set(),
			};
			delta.set(path, found);
			return found;
		};
		for (const note of notes) {
			const before = new Map(
				(note.base?.pendingRelations ?? []).map((record) => [
					locatorKeyOf(record.locator),
					record,
				]),
			);
			const after = new Map(
				note.data.pendingRelations.map((record) => [
					locatorKeyOf(record.locator),
					record,
				]),
			);
			for (const [key, record] of before)
				if (!after.has(key)) {
					const path = shadowPathOf(record);
					if (path) at(path).removed.add(key);
				}
			for (const [key, record] of after)
				if (!before.has(key)) {
					const path = shadowPathOf(record);
					if (path) {
						const found = at(path);
						found.added.add(key);
						found.sample = record;
					}
				}
		}
		const creates: { path: string; content: string }[] = [];
		const trashes: string[] = [];
		for (const [path, { added, removed, sample }] of delta) {
			const before = index.pendingAtShadowPath(path);
			const after = new Set(
				[...before].filter((key) => !removed.has(key)),
			);
			for (const key of added) after.add(key);
			const occupant = index.entry(path);
			if (before.size === 0 && after.size > 0 && sample && !occupant)
				creates.push({ content: SHADOW_BODY(sample), path });
			if (
				before.size > 0 &&
				after.size === 0 &&
				occupant?.kind === "shadow"
			)
				trashes.push(path);
		}
		return { creates, trashes };
	};

	const commitUnderLock = Effect.fnUntraced(function* (
		request: CommitChangesRequest<"de"> | DumdictPlan<"de">,
	): Effect.fn.Return<CommitChangesResult, DictionaryCommitError> {
		if (stale) yield* recover;
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

		const writes: PlannedWrite[] = [];
		const stalePaths: string[] = [];
		for (const note of staged.notes) {
			const planned = yield* planNoteWrite(note);
			if ("_tag" in planned) stalePaths.push(planned.path);
			else writes.push(planned);
		}
		if (stalePaths.length > 0) {
			yield* refresh(stalePaths);
			return conflict("revisionConflict");
		}
		const shadows = planShadows(staged.notes);
		const actions: VaultAction[] = [
			...writes.map(({ action }) => action),
			...shadows.creates.map(
				({ path, content }): VaultAction => ({
					kind: VaultActionKind.UpsertMdFile,
					payload: { content, splitPath: mdSplitPath(path) },
				}),
			),
			...shadows.trashes.map(
				(path): VaultAction => ({
					kind: VaultActionKind.TrashMdFile,
					payload: { splitPath: mdSplitPath(path) },
				}),
			),
		];

		const outcome = yield* Effect.result(
			vault.dispatchStopOnFirstFailure(actions),
		);
		if (outcome._tag === "Failure") {
			const failure = outcome.failure;
			const stopped = failure instanceof VamDispatchStoppedError;
			const rebuilt = yield* recover;
			yield* report;
			return yield* new DictionaryWriteError({
				cause: failure,
				executed: stopped ? failure.executed.map(actionPath) : [],
				message: `The commit's writes stopped: ${message(stopped ? failure.failure : failure)}. The index was ${rebuilt ? "rebuilt from the files" : "not rebuilt; the next operation retries"}.`,
				rebuilt,
				skipped: stopped ? failure.skipped.map(actionPath) : [],
			});
		}

		for (const { path, entry } of writes) {
			index.set(path, entry);
			cache?.delete(path);
		}
		for (const { path, content } of shadows.creates) {
			index.set(path, {
				hash: contentHash(content),
				kind: "shadow",
				path,
			});
			cache?.delete(path);
		}
		for (const path of shadows.trashes) {
			index.set(path, undefined);
			cache?.delete(path);
		}
		bump();
		yield* report;
		return { nextRevision: revision(), status: "committed" };
	});

	const read = <A>(f: () => A) => Effect.sync(f);

	return {
		close,
		commitChanges: (request) => lock.withPermit(commitUnderLock(request)),
		diagnostics: read(diagnosticsNow),
		lemmaCandidates: (texts) =>
			read(() => {
				const found = new Map<
					string,
					{ lemma: Dumling.Lemma<"de">; foundUnder: string[] }
				>();
				for (const text of texts)
					for (const key of index.lemmasWithForm(
						formKeyOf(text, "de"),
					)) {
						const lemma = index.lemmaData(key)?.lemmaRecord.lemma;
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
			read(() => {
				const note = index.lemmaNote(lemmaKeyOf(lemma));
				return note
					? {
							ownedSurfaces: note.data.ownedSurfaceEntries,
							path: note.path,
							pendingRelations: note.data.pendingRelations,
							readings: note.data.readingEntries,
						}
					: undefined;
			}),
		loadCleanupRelationsContext: (request) =>
			read(() => loadCleanupRelationsContext(index, revision(), request)),
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
			read(() => index.readingLocation(readingKeyOf(reading))),
		relationEdgesTo: (lemma) =>
			read(() => index.edgesTo(lemmaKeyOf(lemma))),
		revision: read(revision),
		surface: (surfaceId) => read(() => index.surface(surfaceId)),
	};
});
