import { Cause, Effect, Exit, Result } from "effect";
import type { App } from "obsidian";
import type { RecentTrace } from "./diagnostics/recent-trace";
import type { DispatchOptions } from "./effect/dispatch-coordinator";
import {
	VamDispatchFailure,
	type VamDispatchReport,
} from "./effect/dispatch-report";
import {
	type VamActiveEditorError,
	type VamFileAccessError,
	type VamNoActiveEditorError,
	type VamScanError,
	VamShutdownError,
	VamSubscriptionError,
	VamVaultIoError,
} from "./effect/errors";
import { type VamLiveServices, VaultIo } from "./effect/ports";
import {
	createVamRuntime,
	type VamRuntime,
	type VamRuntimeFailure,
} from "./effect/runtime";
import { makeVamLive } from "./effect/vam-live";
import {
	type ActiveEditorContext,
	ActiveFileService,
} from "./file-services/active-view/active-file-service";
import type { SelectionInfo } from "./file-services/active-view/selection-service";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import { MarkdownFileAccess } from "./file-services/markdown-file-access";
import { splitPathFromAbstractInternal } from "./helpers/pathfinder/path-codecs/split-and-abstract/split-path-from-abstract";
import { DispatchBatchCoordinator } from "./impl/actions-processing/dispatch-batch";
import { Executor } from "./impl/actions-processing/executor";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import { VaultCallbackSequence } from "./impl/event-processing/callback-sequence";
import { LinkRewriteWindows } from "./impl/event-processing/link-rewrite-windows";
import {
	type BulkMdModifyEvent,
	type MdFileModification,
	scopeMdModifyEvent,
} from "./impl/event-processing/md-modify-event";
import {
	classifyProtectedModifications,
	type ProtectedPathModificationsEvent,
} from "./impl/event-processing/protected-modifications";
import { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import {
	VaultObservation,
	type VaultObservationSubscription,
} from "./impl/event-processing/vault-observation";
import { ProtectedPaths } from "./impl/protected-paths";
import { VaultReader } from "./impl/vault-reader";
import { detectVaultFileSystem } from "./internal/file-system-case";
import { splitPathCodec } from "./split-path-codec";
import { VaultActionManagerTestingAdapter } from "./testing-adapter";
import type { VaultFileStat } from "./types/file-stat";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";
import {
	type VaultFileSystem,
	VaultPath,
	type VaultPathIdentity,
} from "./vault-path";
import type {
	VaultCursor,
	VaultScanPathWithStat,
	VaultScanResult,
	VaultSnapshot,
} from "./vault-scan";

export type BulkVaultEventHandler<E = never> = (
	event: BulkVaultEvent,
) => Effect.Effect<void, E>;

export type MdModifyEventHandler<E = never> = (
	event: BulkMdModifyEvent,
) => Effect.Effect<void, E>;

export type ProtectedPathModificationHandler<E = never> = (
	event: ProtectedPathModificationsEvent,
) => Effect.Effect<void, E>;

export type VaultActionManagerOptions = {
	/**
	 * Vault path prefixes no Dispatch Batch may change, such as
	 * `"Exemplar"`. A prefix protects the path itself and everything below
	 * it, by whole segments, compared as the vault's file system compares
	 * names (see `fileSystem`). Dispatch refuses a batch
	 * naming a protected path, or renaming or trashing a folder that contains
	 * one, with `VamProtectedPathError`. The vault root cannot be protected.
	 */
	readonly protectedPaths?: readonly string[];
	/**
	 * How the vault's file system compares names. VAM reads it from
	 * Obsidian's adapter, which probes the vault folder, and falls back to
	 * the platform: macOS and Windows ignore case. Pass it only to override
	 * that, as tests do.
	 */
	readonly fileSystem?: VaultFileSystem;
	/**
	 * Records VAM's spans and Effect log entries, for "Copy recent trace".
	 * Without it VAM's spans are discarded.
	 */
	readonly recentTrace?: RecentTrace;
};

export type VaultActionManagerSubscription = {
	readonly close: Effect.Effect<void, VamRuntimeFailure<never>>;
};

/** What `scanAndSubscribe` delivers after its snapshot. */
export type VaultSnapshotHandlers<E = never> = {
	/** Bulk Vault Events anywhere in the vault, as `subscribeToBulk` delivers them. */
	readonly onBulk?: BulkVaultEventHandler<E>;
	/**
	 * Markdown modifications below the snapshot's folder, as
	 * `subscribeToMdModifications` delivers them.
	 */
	readonly onModifications?: MdModifyEventHandler<E>;
};

/**
 * A snapshot of one folder and a subscription to every change after it.
 * Nothing the snapshot holds is delivered, and nothing after it is lost.
 */
export type VaultSnapshotSubscription = VaultActionManagerSubscription & {
	/**
	 * The part of a delivered bulk event after the latest snapshot; `null`
	 * when that snapshot holds all of it. Delivery already drops what a
	 * snapshot holds; this is for an event a handler took before a
	 * `rescan` and works on after it.
	 */
	readonly afterSnapshot: (event: BulkVaultEvent) => BulkVaultEvent | null;
	/**
	 * Takes a fresh snapshot of the folder and moves the cursor to it, so
	 * changes it holds that are not yet delivered never are. A failure
	 * leaves the cursor where it was. Works after `close`, as a plain
	 * snapshot.
	 */
	readonly rescan: Effect.Effect<
		VaultSnapshot,
		VamRuntimeFailure<VamScanError>
	>;
	/** What the folder held when the subscription began. */
	readonly snapshot: VaultSnapshot;
	/**
	 * Starts delivering the changes after the latest snapshot. Until then
	 * they wait in VAM, so a consumer can build its state from the snapshot
	 * first. Idempotent.
	 */
	readonly start: Effect.Effect<void, VamRuntimeFailure<never>>;
};

function successOrThrow<A>(exit: Exit.Exit<A, unknown>, operation: string): A {
	if (Exit.isSuccess(exit)) return exit.value;
	throw new Error(`Vault Action Manager ${operation} failed`, {
		cause: Cause.squash(exit.cause),
	});
}

/**
 * Canonical Effect facade.
 *
 * Every operation returns an environment-free Effect backed by this manager's
 * single memoized live layer and runtime. Consumers can compose these programs
 * directly and choose where to run them.
 */
export class VaultActionManager {
	readonly testing: VaultActionManagerTestingAdapter;
	/**
	 * Path identity on this vault's file system: case-insensitive where the
	 * file system ignores case. Use it to ask whether two paths would be one
	 * file; use `VaultPath.caseSensitive` to match Obsidian's exact lookup.
	 */
	readonly paths: VaultPathIdentity;

	private readonly dispatches: DispatchBatchCoordinator;
	private readonly linkRewrites = new LinkRewriteWindows();
	private readonly protectedPaths: ProtectedPaths;
	private readonly markdownFiles: MarkdownFileAccess;
	private readonly mdModifyObservation: VaultObservation<
		MdFileModification,
		BulkMdModifyEvent
	>;
	private readonly observation: VaultObservation;
	private readonly reader: VaultReader;
	private readonly selfEvents: SelfEventTracker;
	/** Numbers every vault callback either observation channel hears. */
	private readonly sequence = new VaultCallbackSequence();
	private readonly subscriptionClosers = new Set<Effect.Effect<void>>();
	private disposalPromise: Promise<void> | null = null;

	/** @internal Construct through createVaultActionManager. */
	constructor(
		app: App,
		private readonly runtime: VamRuntime,
		options: VaultActionManagerOptions = {},
	) {
		this.paths = VaultPath.forFileSystem(
			options.fileSystem ?? detectVaultFileSystem(app),
		);
		this.protectedPaths = new ProtectedPaths(
			options.protectedPaths ?? [],
			this.paths,
		);
		this.selfEvents = successOrThrow(
			this.runtime.runSyncExit(SelfEventTracker.makeEffect()),
			"initialize Self Event tracking",
		);
		const activeEditor = new ActiveFileService();
		const tfileHelper = new TFileHelper(this.selfEvents, this.paths);
		const tfolderHelper = new TFolderHelper(this.selfEvents, this.paths);

		this.markdownFiles = new MarkdownFileAccess(activeEditor, tfileHelper);
		this.reader = new VaultReader(
			this.markdownFiles,
			tfileHelper,
			tfolderHelper,
			(effect) => this.runtime.provide(effect),
			app.vault,
		);
		this.observation = successOrThrow(
			this.runtime.runSyncExit(
				VaultObservation.makeEffect(app, this.selfEvents, {
					sequence: this.sequence,
				}),
			),
			"initialize Vault observation",
		);
		this.mdModifyObservation = successOrThrow(
			this.runtime.runSyncExit(
				VaultObservation.makeMdModifyEffect(app, this.selfEvents, {
					sequence: this.sequence,
				}),
			),
			"initialize Markdown modify observation",
		);

		const executor = new Executor(
			tfileHelper,
			tfolderHelper,
			this.markdownFiles,
		);
		this.dispatches = new DispatchBatchCoordinator(
			executor,
			this.selfEvents,
			this.runtime,
			{
				linkRewrites: this.linkRewrites,
				protectedPaths: this.protectedPaths,
			},
		);
		this.testing = new VaultActionManagerTestingAdapter(
			this.runtime,
			this.dispatches,
			[this.observation, this.mdModifyObservation],
			this.selfEvents,
		);
	}

	startListening(): Effect.Effect<
		void,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.runtime.provide(
			this.observation
				.startEffect()
				.pipe(Effect.andThen(this.mdModifyObservation.startEffect())),
		);
	}

	subscribeToBulk<E>(
		handler: BulkVaultEventHandler<E>,
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.trackSubscription(
			this.observation.subscribeEffect(this.effectHandler(handler)),
		);
	}

	/**
	 * Observes content changes to Markdown files below `folder`, such as hand
	 * edits, Obsidian Sync, and Obsidian's link rewriting after a rename.
	 *
	 * Callbacks are coalesced per path over a window with the same quiet and
	 * maximum deadlines as Bulk Vault Events, and VAM's own background writes
	 * are filtered as Self Events. The handler is not called for windows with
	 * no change below `folder`. Observation starts with `startListening`, and
	 * the Vault's root folder observes every Markdown file.
	 */
	subscribeToMdModifications<E>(
		folder: SplitPathToFolder,
		handler: MdModifyEventHandler<E>,
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		const scopedHandler = this.effectHandler(
			(event: BulkMdModifyEvent): Effect.Effect<void, E> => {
				const scoped = scopeMdModifyEvent(event, folder);
				return scoped ? handler(scoped) : Effect.void;
			},
		);
		return this.trackSubscription(
			this.mdModifyObservation.subscribeEffect(scopedHandler),
		);
	}

	/** The configured protected prefixes, normalized. */
	get protectedPathPrefixes(): readonly string[] {
		return this.protectedPaths.prefixes;
	}

	/**
	 * The protected prefix `path` lies at or below, matched as dispatch
	 * matches it; `undefined` when `path` is not protected. Callers check a
	 * path up front so they write nothing elsewhere for it either.
	 */
	protectedPrefixOf(path: string): string | undefined {
		return this.protectedPaths.prefixCovering(path);
	}

	/**
	 * Observes content changes to files under a protected prefix that VAM did
	 * not make. VAM refuses to change those paths itself, but cannot stop
	 * Obsidian's link updater, Sync, other plugins, or the user from writing
	 * them. Each modification carries its most likely `origin`; callers
	 * typically warn about every origin except `OpenInEditor`, the user's own
	 * editing. Delivered over `subscribeToMdModifications`, so it needs
	 * `startListening` and shares its coalescing window.
	 */
	subscribeToProtectedPathModifications<E>(
		handler: ProtectedPathModificationHandler<E>,
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		const protectedHandler = this.effectHandler(
			(event: BulkMdModifyEvent) =>
				classifyProtectedModifications(
					event,
					this.protectedPaths,
					this.linkRewrites,
				).pipe(
					Effect.flatMap((scoped) =>
						scoped ? handler(scoped) : Effect.void,
					),
				),
		);
		return this.trackSubscription(
			this.mdModifyObservation.subscribeEffect(protectedHandler),
		);
	}

	/**
	 * Snapshots `folder` and subscribes to every change after the snapshot.
	 *
	 * The snapshot lists the folder's files with their stats from
	 * Obsidian's in-memory tree, in one synchronous pass on the tick VAM
	 * reads the cursor: the number of the latest vault callback. Handlers
	 * then receive only callbacks numbered after it, filtered and batched
	 * as `subscribeToBulk` and `subscribeToMdModifications` do. A rename
	 * chain that straddles the cursor arrives as its part after it.
	 *
	 * Delivery waits for `start`, so the consumer can build its state from
	 * the snapshot first; `rescan` takes a fresh one. Needs
	 * `startListening`, and fails with a `VamSubscriptionError` before it,
	 * since changes VAM does not hear would be lost. A folder that is not
	 * there fails with a `scanRoot` `VamScanError`.
	 */
	scanAndSubscribe<E>(
		folder: SplitPathToFolder,
		handlers: VaultSnapshotHandlers<E>,
	): Effect.Effect<
		VaultSnapshotSubscription,
		VamRuntimeFailure<VamScanError | VamSubscriptionError>
	> {
		return this.runtime.provide(
			this.openSnapshotSubscription(folder, handlers),
		);
	}

	private readonly openSnapshotSubscription = Effect.fn(
		"vam.scanAndSubscribe",
	)(function* <E>(
		this: VaultActionManager,
		folder: SplitPathToFolder,
		{ onBulk, onModifications }: VaultSnapshotHandlers<E>,
	): Effect.fn.Return<
		VaultSnapshotSubscription,
		VamScanError | VamSubscriptionError,
		VamLiveServices
	> {
		const bulk = onBulk
			? yield* this.subscribeGated(
					this.observation,
					this.effectHandler(onBulk),
				)
			: undefined;
		const closeBulk = bulk?.close ?? Effect.void;
		const modify = onModifications
			? yield* this.subscribeGated(
					this.mdModifyObservation,
					this.effectHandler(
						(event: BulkMdModifyEvent): Effect.Effect<void, E> => {
							const scoped = scopeMdModifyEvent(event, folder);
							return scoped
								? onModifications(scoped)
								: Effect.void;
						},
					),
				).pipe(Effect.onError(() => closeBulk))
			: undefined;
		const parts = [bulk, modify].filter((part) => part !== undefined);
		const close = Effect.all(
			parts.map((part) => part.close),
			{ discard: true },
		);
		const take = Effect.sync(() => {
			// One synchronous step: no vault callback can land between
			// reading the cursor and reading the tree.
			const cursor = this.sequence.current as VaultCursor;
			const result = this.reader.snapshot(folder);
			if (Result.isSuccess(result)) {
				for (const part of parts) part.moveCursor(cursor);
			}
			return Result.map(
				result,
				(scan): VaultSnapshot => ({ ...scan, cursor }),
			);
		}).pipe(
			Effect.flatMap(Effect.fromResult),
			Effect.tap((snapshot) =>
				Effect.annotateCurrentSpan({
					"snapshot.cursor": snapshot.cursor,
					"snapshot.root": splitPathCodec.format(folder),
				}),
			),
		);
		const snapshot = yield* take.pipe(Effect.onError(() => close));
		return {
			afterSnapshot: (event: BulkVaultEvent) =>
				bulk ? bulk.afterCursor(event) : event,
			close: this.trackClose(close),
			rescan: this.runtime.provide(
				take.pipe(Effect.withSpan("vam.scanAndSubscribe.rescan")),
			),
			snapshot,
			start: this.runtime.provide(
				Effect.all(
					parts.map((part) => part.start),
					{ discard: true },
				),
			),
		};
	});

	/** A subscription that delivers nothing until started, on a channel that is listening. */
	private subscribeGated<Ev, M extends object>(
		observation: VaultObservation<Ev, M>,
		handler: (message: M) => Effect.Effect<void, unknown>,
	): Effect.Effect<VaultObservationSubscription<M>, VamSubscriptionError> {
		return observation.subscribeEffect(handler, { gated: true }).pipe(
			Effect.flatMap((subscription) =>
				observation.isListeningEffect().pipe(
					Effect.flatMap((listening) =>
						listening
							? Effect.succeed(subscription)
							: subscription.close.pipe(
									Effect.andThen(
										Effect.fail(
											new VamSubscriptionError({
												cause: new Error(
													"VAM is not listening yet; call startListening first",
												),
												operation: "scanAndSubscribe",
											}),
										),
									),
								),
					),
				),
			),
		);
	}

	/** A consumer's handler, supplied with VAM's services, keeping its cause. */
	private effectHandler<M, E>(
		handler: (message: M) => Effect.Effect<void, E, VamLiveServices>,
	): (message: M) => Effect.Effect<void, VamRuntimeFailure<E>> {
		return (message) => this.runtime.provide(handler(message));
	}

	private trackSubscription(
		subscribe: Effect.Effect<
			{ readonly close: Effect.Effect<void> },
			VamSubscriptionError,
			VamLiveServices
		>,
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.runtime.provide(subscribe).pipe(
			Effect.map((subscription) => ({
				close: this.trackClose(subscription.close),
			})),
		);
	}

	/** Closes `rawClose` at most once, and on disposal if nobody did. */
	private trackClose(
		rawClose: Effect.Effect<void>,
	): Effect.Effect<void, VamRuntimeFailure<never>> {
		this.subscriptionClosers.add(rawClose);
		let active = true;
		return Effect.suspend(() => {
			if (!active) return Effect.void;
			active = false;
			this.subscriptionClosers.delete(rawClose);
			return this.runtime.provide(rawClose);
		});
	}

	/**
	 * Dispatches one ordered, non-atomic batch and answers its report: one
	 * entry per planned action, with what it did. Every planned action is
	 * attempted unless `stopOnFirstFailure` is set, in which case the
	 * actions after the first failure are `Skipped`. On failure the
	 * `VamDispatchFailure` carries the same report. Nothing is rolled back.
	 */
	dispatchWithReport(
		actions: readonly VaultAction[],
		options: DispatchOptions = {},
	): Effect.Effect<VamDispatchReport, VamDispatchFailure> {
		return this.runtime
			.provide(this.dispatches.dispatchEffect(actions, options))
			.pipe(
				Effect.catchTags({
					VamSetupError: (error) =>
						Effect.fail(VamDispatchFailure.notRun(error, actions)),
					VamShutdownError: (error) =>
						Effect.fail(VamDispatchFailure.notRun(error, actions)),
				}),
			);
	}

	/**
	 * `dispatchWithReport` for callers that need only success: every planned
	 * action is attempted, and a failure carries the report.
	 */
	dispatch(
		actions: readonly VaultAction[],
	): Effect.Effect<void, VamDispatchFailure> {
		return Effect.asVoid(this.dispatchWithReport(actions));
	}

	/**
	 * `dispatchWithReport` with `stopOnFirstFailure`, for callers that need
	 * only success. The failure's report lists the actions skipped.
	 */
	dispatchStopOnFirstFailure(
		actions: readonly VaultAction[],
	): Effect.Effect<void, VamDispatchFailure> {
		return Effect.asVoid(
			this.dispatchWithReport(actions, { stopOnFirstFailure: true }),
		);
	}

	readContent(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<string, VamRuntimeFailure<VamFileAccessError>> {
		return this.runtime.provide(this.reader.readContent(splitPath));
	}

	/** Reads like `readContent` and adds the file's stat, taken before the read. */
	readContentWithStat(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<
		{ readonly content: string; readonly stat: VaultFileStat },
		VamRuntimeFailure<VamFileAccessError>
	> {
		return this.runtime.provide(this.reader.readContentWithStat(splitPath));
	}

	/** The file's stat on disk, without reading its content. */
	readStat(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<VaultFileStat, VamRuntimeFailure<VamFileAccessError>> {
		return this.runtime.provide(this.reader.readStat(splitPath));
	}

	exists(
		splitPath: AnySplitPath,
	): Effect.Effect<boolean, VamRuntimeFailure<never>> {
		return this.runtime.provide(this.reader.exists(splitPath));
	}

	findByBasename(
		basename: string,
		options?: { folder?: SplitPathToFolder },
	): Effect.Effect<SplitPathToMdFile[], VamRuntimeFailure<VamVaultIoError>> {
		return this.runtime.provide(
			this.reader.findByBasename(basename, options),
		);
	}

	resolveLinkpathDest(
		linkpath: string,
		from: SplitPathToMdFile,
	): Effect.Effect<
		SplitPathToMdFile | null,
		VamRuntimeFailure<VamVaultIoError>
	> {
		const sourcePath = splitPathCodec.format(from);
		const program = VaultIo.use((vault) =>
			vault.resolveLinkpathDest(linkpath, sourcePath),
		).pipe(
			Effect.flatMap((file) =>
				file
					? Effect.try({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "resolveLinkpathDest.decode",
									path: sourcePath,
								}),
							try: () => {
								const splitPath =
									splitPathFromAbstractInternal(file);
								return splitPath.kind === "MdFile"
									? splitPath
									: null;
							},
						})
					: Effect.succeed(null),
			),
		);
		return this.runtime.provide(program);
	}

	list(
		splitPath: SplitPathToFolder,
	): Effect.Effect<AnySplitPath[], VamRuntimeFailure<VamVaultIoError>> {
		return this.runtime.provide(this.reader.list(splitPath));
	}

	scan(
		splitPath: SplitPathToFolder,
	): Effect.Effect<VaultScanResult, VamRuntimeFailure<VamScanError>> {
		return this.runtime.provide(this.reader.scan(splitPath));
	}

	/**
	 * Scans like `scan` and adds each file's stat, so a startup index can key
	 * cached entries by `(path, mtime)`. Files without a readable stat are
	 * omitted and reported as `scanFile` diagnostics.
	 */
	scanWithStat(
		splitPath: SplitPathToFolder,
	): Effect.Effect<
		VaultScanResult<VaultScanPathWithStat>,
		VamRuntimeFailure<VamScanError>
	> {
		return this.runtime.provide(this.reader.scanWithStat(splitPath));
	}

	mdPwd(): Effect.Effect<
		SplitPathToMdFile | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.runtime.provide(this.markdownFiles.activeMdPath());
	}

	getActiveEditorContext(): Effect.Effect<
		ActiveEditorContext | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.runtime.provide(this.markdownFiles.activeContext());
	}

	getOpenedContent(): Effect.Effect<
		string,
		VamRuntimeFailure<
			VamVaultIoError | VamActiveEditorError | VamNoActiveEditorError
		>
	> {
		return this.runtime.provide(this.markdownFiles.openedContent());
	}

	getSelectionInfo(): Effect.Effect<
		SelectionInfo | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.runtime.provide(this.markdownFiles.selectionInfo());
	}

	getSelectionText(): Effect.Effect<
		string | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.runtime.provide(this.markdownFiles.selectionText());
	}

	replaceActiveLine(args: {
		readonly after: string;
		readonly before: string;
		readonly line: number;
		readonly splitPath: SplitPathToMdFile;
	}): Effect.Effect<void, VamRuntimeFailure<VamFileAccessError>> {
		return this.runtime.provide(this.markdownFiles.replaceOpenedLine(args));
	}

	cd(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<
		void,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.runtime.provide(this.markdownFiles.open(splitPath));
	}

	scrollOpenedFileToLine(
		line: number,
	): Effect.Effect<
		void,
		VamRuntimeFailure<
			VamVaultIoError | VamActiveEditorError | VamNoActiveEditorError
		>
	> {
		return this.runtime.provide(
			this.markdownFiles.scrollOpenedFileToLine(line),
		);
	}

	disposeEffect(): Effect.Effect<void, VamShutdownError> {
		return Effect.tryPromise({
			catch: (cause) =>
				new VamShutdownError({ cause, operation: "dispose" }),
			try: () => this.dispose(),
		});
	}

	private dispose(): Promise<void> {
		if (this.disposalPromise) return this.disposalPromise;
		this.disposalPromise = this.disposeOnce();
		return this.disposalPromise;
	}

	private async disposeOnce(): Promise<void> {
		const closes = [...this.subscriptionClosers];
		this.subscriptionClosers.clear();
		const cleanup = Effect.all(closes, { discard: true }).pipe(
			Effect.andThen(this.observation.disposeEffect()),
			Effect.andThen(this.mdModifyObservation.disposeEffect()),
			Effect.andThen(this.dispatches.shutdownEffect()),
			Effect.ignore,
		);
		try {
			await this.runtime.runPromiseExit(cleanup);
		} finally {
			await this.runtime.dispose();
		}
	}
}

export type VaultActionManagerFactoryResult = {
	readonly dispose: Effect.Effect<void, VamShutdownError>;
	readonly manager: VaultActionManager;
	readonly testing: VaultActionManagerTestingAdapter;
};

/** Builds the canonical Effect facade over one ManagedRuntime. */
export function createVaultActionManager(
	app: App,
	options: VaultActionManagerOptions = {},
): VaultActionManagerFactoryResult {
	const runtime = createVamRuntime(
		makeVamLive(app, { recentTrace: options.recentTrace }),
	);
	const manager = new VaultActionManager(app, runtime, options);
	return {
		dispose: manager.disposeEffect(),
		manager,
		testing: manager.testing,
	};
}

export type { DispatchOptions } from "./effect/dispatch-coordinator";
export {
	isContentConflict,
	type VamActionOutcome,
	type VamDispatchEntry,
	VamDispatchFailure,
	type VamDispatchFailureReason,
	VamDispatchReport,
	type VamTouchedVault,
} from "./effect/dispatch-report";
export {
	describeVaultActionPath,
	type VamActionFailureKind,
	VamActionFailureKindSchema,
	VamActiveEditorError,
	type VamActiveEditorFailureReason,
	VamActiveEditorFailureReasonSchema,
	VamContentConflictError,
	VamDispatchError,
	VamDispatchOverflowError,
	type VamEffectError,
	type VamFileAccessError,
	type VamFileWriteError,
	VamNoActiveEditorError,
	VamPlanningError,
	VamProtectedPathError,
	VamScanError,
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VamTargetExistsError,
	VamVaultIoError,
} from "./effect/errors";
