import {
	Cause,
	Context,
	Effect,
	Layer,
	ManagedRuntime,
	Result,
	Scheduler,
} from "effect";
import type { App } from "obsidian";
import type { RecentTrace } from "./diagnostics/recent-trace";
import type {
	DispatchCaller,
	DispatchOptions,
} from "./effect/dispatch-coordinator";
import {
	VamDispatchFailure,
	type VamDispatchReport,
} from "./effect/dispatch-report";
import {
	type VamActiveEditorError,
	type VamFileAccessError,
	type VamFileReadError,
	type VamNoActiveEditorError,
	type VamScanError,
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VamVaultIoError,
} from "./effect/errors";
import { vamOwnObservability } from "./effect/logger";
import {
	ActiveEditorAccess,
	HiddenFolderIo,
	type VamLiveServices,
	type VamPorts,
	VaultIo,
} from "./effect/ports";
import {
	type VamProvide,
	type VamRuntimeFailure,
	VamServices,
} from "./effect/services";
import {
	type DispatchOrUndoOptions,
	dispatchOrUndoVia,
} from "./effect/undo-on-failure";
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
import { LinkUpdates } from "./impl/event-processing/link-updates";
import {
	type BulkMdModifyEvent,
	type MdFileChange,
	mdChangesBelow,
	scopeMdModifyEvent,
} from "./impl/event-processing/md-modify-event";
import {
	classifyProtectedModifications,
	type ProtectedPathModificationsEvent,
} from "./impl/event-processing/protected-modifications";
import { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import {
	type ObservationScope,
	VaultObservation,
	type VaultObservationSubscription,
} from "./impl/event-processing/vault-observation";
import { ProtectedPaths } from "./impl/protected-paths";
import { VaultReader } from "./impl/vault-reader";
import { splitPathCodec } from "./split-path-codec";
import { VaultActionManagerTestingAdapter } from "./testing-adapter";
import {
	type OriginFilter,
	originFilter,
	type VamOperation,
	type VamSubscribeOptions,
} from "./types/event-origin";
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

type VaultActionManagerCoreOptions = {
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
};

/**
 * Who decides where VAM's spans and log entries go.
 *
 * - `"vam"` (the default): VAM installs its console logger for every
 *   program it runs, its dispatch batches and its vault callbacks, and,
 *   when `recentTrace` is given, that trace's tracer and logger too; a
 *   caller's tracer then does not see VAM's spans. Without `recentTrace`,
 *   VAM's spans go to the caller's tracer.
 * - `"host"`: VAM installs none, and its spans and logs go wherever the
 *   caller's fiber sends them; each Dispatch Batch runs with its
 *   submitter's tracer and loggers. Vault callbacks run with the context
 *   the Layer was built in, so provide the host's tracer and loggers to
 *   the Layer, with `Layer.provide` or `Layer.provideMerge`, not beside it
 *   with `Layer.merge`.
 */
export type VaultActionManagerObservability =
	| {
			readonly observability?: "vam";
			/**
			 * Records VAM's spans and Effect log entries, for "Copy recent
			 * trace".
			 */
			readonly recentTrace?: RecentTrace;
	  }
	| { readonly observability: "host"; readonly recentTrace?: never };

export type VaultActionManagerOptions = VaultActionManagerCoreOptions &
	VaultActionManagerObservability;

/**
 * Files under one hidden (dot) folder of the vault, such as
 * `.textfresser`, which Obsidian neither indexes nor reports in vault
 * callbacks. Paths are relative to the folder; one that leaves it, through
 * `..`, `.` or an empty segment, fails with a `VamVaultIoError` before
 * anything is touched.
 */
export type HiddenFolder = {
	/** The folder's vault path. */
	readonly folder: string;
	exists(
		path: string,
	): Effect.Effect<boolean, VamRuntimeFailure<VamVaultIoError>>;
	read(
		path: string,
	): Effect.Effect<string, VamRuntimeFailure<VamVaultIoError>>;
	write(
		path: string,
		data: string,
	): Effect.Effect<void, VamRuntimeFailure<VamVaultIoError>>;
	/** Creates the folder at `path`, and its parents. */
	mkdir(
		path: string,
	): Effect.Effect<void, VamRuntimeFailure<VamVaultIoError>>;
};

export type VaultActionManagerSubscription = {
	/**
	 * Completes once the handler has run for every vault callback VAM heard
	 * before the call, or skipped it (before the cursor, or of an origin the
	 * subscription leaves out). It waits for the open window's own deadlines
	 * (at most `maxWindowMs`, 2 s) and does not close it early. A gated
	 * subscription waits until it starts. Never await it inside the same
	 * subscription's handler: the handler would wait for itself.
	 */
	readonly caughtUp: Effect.Effect<void, VamRuntimeFailure<never>>;
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

/** What one Vault Action Manager is built from, in its Layer. */
type VamParts = {
	readonly dispatches: DispatchBatchCoordinator;
	readonly linkUpdates: LinkUpdates;
	readonly markdownFiles: MarkdownFileAccess;
	readonly mdModifyObservation: VaultObservation<
		MdFileChange,
		BulkMdModifyEvent
	>;
	readonly observation: VaultObservation;
	readonly paths: VaultPathIdentity;
	readonly protectedPaths: ProtectedPaths;
	readonly reader: VaultReader;
	readonly selfEvents: SelfEventTracker;
	readonly sequence: VaultCallbackSequence;
	readonly services: VamServices;
	/** Each open subscription's close, for shutdown to run. */
	readonly subscriptionClosers: Set<Effect.Effect<void>>;
};

/**
 * Canonical Effect facade.
 *
 * Every operation returns an environment-free Effect that runs with this
 * manager's services, on whatever fiber runs it. Consumers can compose
 * these programs directly and choose where to run them. Build one with
 * `VaultActionManager.layer`, or `createVaultActionManager` outside an
 * Effect runtime.
 */
class VaultActionManagerFacade {
	readonly testing: VaultActionManagerTestingAdapter;
	/**
	 * Path identity on this vault's file system: case-insensitive where the
	 * file system ignores case. Use it to ask whether two paths would be one
	 * file; use `VaultPath.caseSensitive` to match Obsidian's exact lookup.
	 */
	readonly paths: VaultPathIdentity;

	private readonly dispatches: DispatchBatchCoordinator;
	private readonly linkUpdates: LinkUpdates;
	private readonly protectedPaths: ProtectedPaths;
	private readonly markdownFiles: MarkdownFileAccess;
	private readonly mdModifyObservation: VaultObservation<
		MdFileChange,
		BulkMdModifyEvent
	>;
	/** Numbers the batches dispatched without an operation id. */
	private operationCount = 0;
	private readonly observation: VaultObservation;
	private readonly provide: VamProvide;
	private readonly reader: VaultReader;
	/** Numbers every vault callback either observation channel hears. */
	private readonly sequence: VaultCallbackSequence;
	private readonly services: VamServices;
	private readonly subscriptionClosers: Set<Effect.Effect<void>>;

	/** @internal Built by `VaultActionManager.layer`. */
	constructor(parts: VamParts) {
		this.dispatches = parts.dispatches;
		this.linkUpdates = parts.linkUpdates;
		this.markdownFiles = parts.markdownFiles;
		this.mdModifyObservation = parts.mdModifyObservation;
		this.observation = parts.observation;
		this.paths = parts.paths;
		this.protectedPaths = parts.protectedPaths;
		this.reader = parts.reader;
		this.sequence = parts.sequence;
		this.services = parts.services;
		this.subscriptionClosers = parts.subscriptionClosers;
		this.provide = parts.services.provide;
		this.testing = new VaultActionManagerTestingAdapter(
			this.provide,
			this.dispatches,
			[this.observation, this.mdModifyObservation],
			parts.selfEvents,
		);
	}

	startListening(): Effect.Effect<
		void,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.provide(
			this.observation
				.startEffect()
				.pipe(Effect.andThen(this.mdModifyObservation.startEffect())),
		);
	}

	/**
	 * Delivers Bulk Vault Events anywhere in the vault, each event with its
	 * `origin`. `from` picks the origins: VAM's own writes are left out by
	 * default (`external`); `allButMine` leaves out only `caller`'s; `all`
	 * keeps every one.
	 */
	subscribeToBulk<E>(
		handler: BulkVaultEventHandler<E>,
		options: VamSubscribeOptions = {},
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.trackSubscription(
			this.observation.subscribeEffect(this.effectHandler(handler), {
				filter: originFilter(options),
			}),
		);
	}

	/**
	 * Observes content changes to Markdown files below `folder`, such as hand
	 * edits, Obsidian Sync, and Obsidian's link rewriting after a rename.
	 *
	 * Callbacks are coalesced per path over a window with the same quiet and
	 * maximum deadlines as Bulk Vault Events. Each modification carries its
	 * `origin`, and `from` picks the origins as for `subscribeToBulk`: by
	 * default VAM's own background writes are left out, while Obsidian's
	 * link rewriting after a VAM rename arrives as `LinkUpdate`. The handler
	 * is not called for windows with no change below `folder`. Observation
	 * starts with `startListening`, and the Vault's root folder observes
	 * every Markdown file.
	 */
	subscribeToMdModifications<E>(
		folder: SplitPathToFolder,
		handler: MdModifyEventHandler<E>,
		options: VamSubscribeOptions = {},
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
			this.mdModifyObservation.subscribeEffect(scopedHandler, {
				filter: originFilter(options),
				scope: mdChangesBelow(folder),
			}),
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
	 * Observes content changes to files under a protected prefix. VAM
	 * refuses to change those paths itself, and puts back a protected file
	 * Obsidian's link updater rewrites after a VAM rename that it predicted
	 * (`RestoredAfterLinkUpdate`). It cannot stop Sync, other plugins, the
	 * user, or an unpredicted rewrite. Each modification carries its most
	 * likely `writer`, from its origin, VAM's restorations and the open
	 * editors; callers typically warn about every writer except
	 * `OpenInEditor`, the user's own editing. Delivered over
	 * `subscribeToMdModifications` with every origin, so it needs
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
					this.linkUpdates,
				).pipe(
					Effect.flatMap((scoped) =>
						scoped ? handler(scoped) : Effect.void,
					),
				),
		);
		// Every origin: VAM writes a protected path only to put it back, so
		// any other change labelled VAM's is a misattribution, and must not
		// hide a change.
		return this.trackSubscription(
			this.mdModifyObservation.subscribeEffect(protectedHandler, {
				filter: originFilter({ from: "all" }),
				scope: {
					accepts: ({ splitPath }) =>
						this.protectedPaths.prefixCovering(
							splitPathCodec.format(splitPath),
						) !== undefined,
					key: "protected",
				},
			}),
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
	 * the snapshot first; `rescan` takes a fresh one. `options.from` picks
	 * the origins both handlers receive, as for `subscribeToBulk`. Needs
	 * `startListening`, and fails with a `VamSubscriptionError` before it,
	 * since changes VAM does not hear would be lost. A folder that is not
	 * there fails with a `scanRoot` `VamScanError`.
	 */
	scanAndSubscribe<E>(
		folder: SplitPathToFolder,
		handlers: VaultSnapshotHandlers<E>,
		options: VamSubscribeOptions = {},
	): Effect.Effect<
		VaultSnapshotSubscription,
		VamRuntimeFailure<VamScanError | VamSubscriptionError>
	> {
		return this.provide(
			this.openSnapshotSubscription(folder, handlers, options),
		);
	}

	private readonly openSnapshotSubscription = Effect.fn(
		"vam.scanAndSubscribe",
	)(function* <E>(
		this: VaultActionManagerFacade,
		folder: SplitPathToFolder,
		{ onBulk, onModifications }: VaultSnapshotHandlers<E>,
		options: VamSubscribeOptions,
	): Effect.fn.Return<
		VaultSnapshotSubscription,
		VamScanError | VamSubscriptionError,
		VamLiveServices
	> {
		const filter = originFilter(options);
		const bulk = onBulk
			? yield* this.subscribeGated(
					this.observation,
					this.effectHandler(onBulk),
					filter,
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
					filter,
					mdChangesBelow(folder),
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
			caughtUp: this.provide(
				Effect.all(
					parts.map((part) => part.caughtUp),
					{ concurrency: "unbounded", discard: true },
				),
			),
			close: this.trackClose(close),
			rescan: this.provide(
				take.pipe(Effect.withSpan("vam.scanAndSubscribe.rescan")),
			),
			snapshot,
			start: this.provide(
				Effect.all(
					parts.map((part) => part.start),
					{ discard: true },
				),
			),
		};
	});

	/** A subscription that delivers nothing until started, on a channel that is listening. */
	private subscribeGated<Ev, M extends object, E>(
		observation: VaultObservation<Ev, M>,
		handler: (message: M) => Effect.Effect<void, E>,
		filter: OriginFilter,
		scope?: ObservationScope<Ev>,
	): Effect.Effect<VaultObservationSubscription<M>, VamSubscriptionError> {
		return observation
			.subscribeEffect(handler, { filter, gated: true, scope })
			.pipe(
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
													operation:
														"scanAndSubscribe",
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
		return (message) => this.provide(handler(message));
	}

	private trackSubscription(
		subscribe: Effect.Effect<
			{
				readonly caughtUp: Effect.Effect<void>;
				readonly close: Effect.Effect<void>;
			},
			VamSubscriptionError,
			VamLiveServices
		>,
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.provide(subscribe).pipe(
			Effect.map((subscription) => ({
				caughtUp: this.provide(subscription.caughtUp),
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
			// Shutdown already closed it.
			if (!active || this.services.isClosed) return Effect.void;
			active = false;
			this.subscriptionClosers.delete(rawClose);
			return this.provide(rawClose);
		});
	}

	/**
	 * Dispatches one ordered, non-atomic batch for `options.caller` and
	 * answers its report: one entry per planned action, with what it did.
	 * Every planned action is attempted unless `stopOnFirstFailure` is set,
	 * in which case the actions after the first failure are `Skipped`. On
	 * failure the `VamDispatchFailure` carries the same report. Nothing is
	 * rolled back; `dispatchOrUndo` undoes what it can.
	 *
	 * The batch's `operationId`, given or made here, names it in the report,
	 * on its `vam.dispatch` span, and in the `Vam` origin of the events it
	 * causes. Each run of the Effect is one batch, so a retried Effect
	 * without an `operationId` gets a fresh one.
	 */
	dispatchWithReport(
		actions: readonly VaultAction[],
		options: DispatchOptions,
	): Effect.Effect<VamDispatchReport, VamDispatchFailure> {
		return Effect.suspend(() => {
			const operation = this.operationFor(options);
			return this.provide(
				this.dispatches.dispatchEffect(actions, {
					operation,
					stopOnFirstFailure: options.stopOnFirstFailure,
				}),
			).pipe(
				Effect.catchTags({
					VamSetupError: (error) =>
						Effect.fail(
							VamDispatchFailure.notRun(
								error,
								actions,
								operation,
							),
						),
					VamShutdownError: (error) =>
						Effect.fail(
							VamDispatchFailure.notRun(
								error,
								actions,
								operation,
							),
						),
				}),
			);
		});
	}

	/**
	 * `dispatchWithReport` for callers that need only success: every planned
	 * action is attempted, and a failure carries the report.
	 */
	dispatch(
		actions: readonly VaultAction[],
		caller: DispatchCaller,
	): Effect.Effect<void, VamDispatchFailure> {
		return Effect.asVoid(this.dispatchWithReport(actions, caller));
	}

	/**
	 * `dispatchWithReport` with `stopOnFirstFailure`, for callers that need
	 * only success. The failure's report lists the actions skipped.
	 */
	dispatchStopOnFirstFailure(
		actions: readonly VaultAction[],
		caller: DispatchCaller,
	): Effect.Effect<void, VamDispatchFailure> {
		return Effect.asVoid(
			this.dispatchWithReport(actions, {
				...caller,
				stopOnFirstFailure: true,
			}),
		);
	}

	/**
	 * Dispatches one batch that stops at its first failure and, on failure,
	 * undoes what landed, guarded and newest first: a created note is
	 * trashed only while it holds what it was created with, a write is
	 * reverted only while the file holds what it wrote, and a rename moves
	 * back only while the file is where it went and its old name is free.
	 * Trashes are not undone, and `Uncertain` actions are probed, never
	 * blindly inverted. The failure's `report.undo` says what was undone,
	 * what could not be and why, and what is not undoable. Pre-images of
	 * the files the batch writes are read before it runs. The inverse
	 * batches run under the batch's own `caller` and `operationId`. The
	 * failure keeps every failure and defect of the batch's cause, with the
	 * `VamDispatchFailure` as its first failure (see `dispatchOrUndoVia`).
	 */
	dispatchOrUndo(
		actions: readonly VaultAction[],
		options: DispatchOrUndoOptions,
	): Effect.Effect<VamDispatchReport, VamDispatchFailure> {
		// One operation for the batch and its undo, named before either runs.
		return Effect.suspend(() =>
			dispatchOrUndoVia(this, actions, {
				...options,
				...this.operationFor(options),
			}),
		);
	}

	/** The batch's operation: its given id, or the caller's next one. */
	private operationFor({
		caller,
		operationId,
	}: DispatchCaller): VamOperation {
		if (operationId !== undefined) return { caller, operationId };
		this.operationCount += 1;
		return { caller, operationId: `${caller}#${this.operationCount}` };
	}

	readContent(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<string, VamRuntimeFailure<VamFileReadError>> {
		return this.provide(this.reader.readContent(splitPath));
	}

	/** Reads like `readContent` and adds the file's stat, taken before the read. */
	readContentWithStat(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<
		{ readonly content: string; readonly stat: VaultFileStat },
		VamRuntimeFailure<VamFileReadError>
	> {
		return this.provide(this.reader.readContentWithStat(splitPath));
	}

	/** The file's stat on disk, without reading its content. */
	readStat(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<VaultFileStat, VamRuntimeFailure<VamFileAccessError>> {
		return this.provide(this.reader.readStat(splitPath));
	}

	exists(
		splitPath: AnySplitPath,
	): Effect.Effect<boolean, VamRuntimeFailure<never>> {
		return this.provide(this.reader.exists(splitPath));
	}

	findByBasename(
		basename: string,
		options?: { folder?: SplitPathToFolder; ignoreCase?: boolean },
	): Effect.Effect<SplitPathToMdFile[], VamRuntimeFailure<VamVaultIoError>> {
		return this.provide(this.reader.findByBasename(basename, options));
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
		return this.provide(program);
	}

	/**
	 * Where Obsidian resolves `link` from the note at `sourcePath`, as a
	 * vault path, any kind of file; `null` when it resolves nowhere. It
	 * reads Obsidian's metadata cache and never waits, so an edge that must
	 * answer synchronously, such as an editor event, can run it with
	 * `runSync`.
	 */
	resolveLinkpath(
		link: string,
		sourcePath: string,
	): Effect.Effect<string | null, VamRuntimeFailure<VamVaultIoError>> {
		return this.provide(
			VaultIo.use((vault) =>
				vault.resolveLinkpathDest(link, sourcePath),
			).pipe(Effect.map((file) => file?.path ?? null)),
		);
	}

	/**
	 * Reads and writes files under the hidden folder `folder`, a vault path
	 * whose first segment starts with `.`, such as `.textfresser`. Obsidian
	 * keeps such files out of its tree and fires no vault callback for them,
	 * so they bypass dispatch, Self Events and observation. A `folder` that
	 * is not hidden, or lies in Obsidian's config folder (`.obsidian`),
	 * fails every operation with a `VamVaultIoError`.
	 */
	hiddenFolder(folder: string): HiddenFolder {
		const root = VaultPath.normalize(folder);
		const resolve = (
			operation: string,
			path: string,
			configDir: string | undefined,
		) =>
			Effect.suspend(() => {
				const problem = hiddenPathProblem(root, path, configDir);
				return problem
					? Effect.fail(
							new VamVaultIoError({
								cause: new Error(problem),
								operation: `hiddenFolder.${operation}`,
								path: `${root}/${path}`,
							}),
						)
					: Effect.succeed(VaultPath.join(root, path));
			});
		const run = <A>(
			operation: string,
			path: string,
			use: (
				io: HiddenFolderIo["Service"],
				vaultPath: string,
			) => Effect.Effect<A, VamVaultIoError>,
		) =>
			this.provide(
				HiddenFolderIo.use((io) =>
					resolve(operation, path, io.configDir).pipe(
						Effect.flatMap((vaultPath) => use(io, vaultPath)),
					),
				),
			);
		return {
			exists: (path) =>
				run("exists", path, (io, vaultPath) => io.exists(vaultPath)),
			folder: root,
			mkdir: (path) =>
				run("mkdir", path, (io, vaultPath) => io.mkdir(vaultPath)),
			read: (path) =>
				run("read", path, (io, vaultPath) => io.read(vaultPath)),
			write: (path, data) =>
				run("write", path, (io, vaultPath) =>
					io.write(vaultPath, data),
				),
		};
	}

	list(
		splitPath: SplitPathToFolder,
	): Effect.Effect<AnySplitPath[], VamRuntimeFailure<VamVaultIoError>> {
		return this.provide(this.reader.list(splitPath));
	}

	scan(
		splitPath: SplitPathToFolder,
	): Effect.Effect<VaultScanResult, VamRuntimeFailure<VamScanError>> {
		return this.provide(this.reader.scan(splitPath));
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
		return this.provide(this.reader.scanWithStat(splitPath));
	}

	mdPwd(): Effect.Effect<
		SplitPathToMdFile | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.provide(this.markdownFiles.activeMdPath());
	}

	getActiveEditorContext(): Effect.Effect<
		ActiveEditorContext | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.provide(this.markdownFiles.activeContext());
	}

	getOpenedContent(): Effect.Effect<
		string,
		VamRuntimeFailure<
			VamVaultIoError | VamActiveEditorError | VamNoActiveEditorError
		>
	> {
		return this.provide(this.markdownFiles.openedContent());
	}

	getSelectionInfo(): Effect.Effect<
		SelectionInfo | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.provide(this.markdownFiles.selectionInfo());
	}

	getSelectionText(): Effect.Effect<
		string | null,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.provide(this.markdownFiles.selectionText());
	}

	replaceActiveLine(args: {
		readonly after: string;
		readonly before: string;
		readonly line: number;
		readonly splitPath: SplitPathToMdFile;
	}): Effect.Effect<void, VamRuntimeFailure<VamFileAccessError>> {
		return this.provide(this.markdownFiles.replaceOpenedLine(args));
	}

	cd(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<
		void,
		VamRuntimeFailure<VamVaultIoError | VamActiveEditorError>
	> {
		return this.provide(this.markdownFiles.open(splitPath));
	}

	scrollOpenedFileToLine(
		line: number,
	): Effect.Effect<
		void,
		VamRuntimeFailure<
			VamVaultIoError | VamActiveEditorError | VamNoActiveEditorError
		>
	> {
		return this.provide(this.markdownFiles.scrollOpenedFileToLine(line));
	}
}

/**
 * Why `path` is no file under the hidden folder `root`; `undefined` when it
 * is. A segment of only dots and spaces is refused, since Windows trims it
 * to nothing or to `..`.
 */
function hiddenPathProblem(
	root: string,
	path: string,
	configDir: string | undefined,
): string | undefined {
	const notInside = (segment: string) => /^[. ]*$/.test(segment);
	if (!root.startsWith(".") || root.split("/").some(notInside))
		return `"${root}" is not a hidden folder: its first segment must start with "."`;
	if (
		configDir !== undefined &&
		VaultPath.caseInsensitive.isUnder(root, configDir, { inclusive: true })
	)
		return `"${root}" is in Obsidian's config folder "${configDir}"`;
	if (path.split(/[\\/]/).some(notInside))
		return `"${path}" is not a relative path inside "${root}"`;
	return undefined;
}

/** The facade a `VaultActionManager` Layer provides. */
export type VaultActionManager = VaultActionManagerFacade;

const VaultActionManagerKey = Context.Service<VaultActionManager>(
	"@textfresser/vault-action-manager/VaultActionManager",
);

const makeManager = Effect.fnUntraced(function* (
	options: VaultActionManagerCoreOptions,
	own: Context.Context<never>,
) {
	const built = yield* Effect.context<VamPorts>();
	const vault = Context.get(built, VaultIo);
	const services = new VamServices(
		Context.merge(
			Context.pick(VaultIo, ActiveEditorAccess, HiddenFolderIo)(built),
			own,
		),
	);
	const paths = VaultPath.forFileSystem(
		options.fileSystem ?? vault.fileSystem,
	);
	const protectedPaths = new ProtectedPaths(
		options.protectedPaths ?? [],
		paths,
	);
	const selfEvents = yield* SelfEventTracker.makeEffect();
	const activeEditor = new ActiveFileService();
	const tfileHelper = new TFileHelper(selfEvents, paths);
	const tfolderHelper = new TFolderHelper(selfEvents, paths);
	const linkUpdates = new LinkUpdates({
		files: tfileHelper,
		protectedPaths,
	});
	const markdownFiles = new MarkdownFileAccess(activeEditor, tfileHelper);
	const reader = new VaultReader(
		markdownFiles,
		tfileHelper,
		tfolderHelper,
		services.provide,
		vault.tree,
	);
	const sequence = new VaultCallbackSequence();
	const observation = yield* VaultObservation.makeEffect(
		vault.listen,
		selfEvents,
		{ sequence },
	);
	yield* Effect.addFinalizer(() => observation.disposeEffect());
	const mdModifyObservation = yield* VaultObservation.makeMdModifyEffect(
		vault.listen,
		selfEvents,
		{ linkUpdates, sequence },
	);
	yield* Effect.addFinalizer(() => mdModifyObservation.disposeEffect());
	const dispatches = new DispatchBatchCoordinator(
		new Executor(tfileHelper, tfolderHelper, markdownFiles),
		selfEvents,
		{ linkUpdates, protectedPaths },
	);
	// Started at once, so it is taking batches before the build returns. A
	// build run synchronously (`runSync`) carries a sync scheduler, whose
	// yields never let Obsidian paint; the worker outlives the build, so it
	// gets the default one.
	const scheduler = yield* Scheduler.Scheduler;
	const forkWorker = Effect.forkScoped(dispatches.run, {
		startImmediately: true,
	});
	yield* scheduler.executionMode === "sync"
		? forkWorker.pipe(
				Effect.provideService(
					Scheduler.Scheduler,
					new Scheduler.MixedScheduler(),
				),
			)
		: forkWorker;
	const subscriptionClosers = new Set<Effect.Effect<void>>();
	const manager = new VaultActionManagerFacade({
		dispatches,
		linkUpdates,
		markdownFiles,
		mdModifyObservation,
		observation,
		paths,
		protectedPaths,
		reader,
		selfEvents,
		sequence,
		services,
		subscriptionClosers,
	});
	// Added after the worker's fork, so it runs before the worker is
	// interrupted: new programs are refused, subscriptions and both
	// channels close, and the active batch finishes while queued ones fail.
	yield* Effect.addFinalizer(() =>
		Effect.suspend(() => {
			services.close();
			const closes = [...subscriptionClosers];
			subscriptionClosers.clear();
			return Effect.all(closes, { discard: true });
		}).pipe(
			Effect.andThen(observation.disposeEffect()),
			Effect.andThen(mdModifyObservation.disposeEffect()),
			Effect.andThen(dispatches.shutdownEffect()),
			Effect.catchCause((cause) =>
				Effect.logError(
					"[VaultActionManager] Shutdown did not finish cleanly",
					cause,
				),
			),
			Effect.withSpan("vam.shutdown"),
		),
	);
	return manager;
});

/** One `VamSetupError` for a failed build, keeping its whole cause. */
function setupErrorOf(cause: Cause.Cause<unknown>): VamSetupError {
	const [only, ...rest] = cause.reasons;
	if (
		only !== undefined &&
		rest.length === 0 &&
		Cause.isFailReason(only) &&
		only.error instanceof VamSetupError
	)
		return only.error;
	return new VamSetupError({
		cause,
		operation: "build the Vault Action Manager",
	});
}

/**
 * The Vault Action Manager over Obsidian's `App`: its ports, its facade,
 * both observation channels, and its dispatch worker, forked in the
 * Layer's scope. Closing that scope shuts it down: new programs fail with
 * `VamShutdownError`, subscriptions close, the vault listeners are
 * released, the active batch finishes and the queued ones fail. A build
 * that fails fails with one `VamSetupError` whose `cause` holds the whole
 * `Cause`.
 */
function vaultActionManagerLayer(
	app: App,
	options: VaultActionManagerOptions = {},
): Layer.Layer<VaultActionManager, VamSetupError> {
	const own =
		options.observability === "host"
			? Context.empty()
			: vamOwnObservability(options.recentTrace);
	return Layer.effect(VaultActionManagerKey, makeManager(options, own)).pipe(
		Layer.provide(makeVamLive(app)),
		Layer.provide(Layer.succeedContext(own)),
		Layer.catchCause((cause) =>
			Layer.effect(
				VaultActionManagerKey,
				// An interrupted build stays an interruption.
				Cause.hasInterruptsOnly(cause)
					? Effect.failCause(cause)
					: Effect.fail(setupErrorOf(cause)),
			),
		),
	);
}

/**
 * The Vault Action Manager service, and its Layer:
 * `VaultActionManager.layer(app, options)`.
 */
export const VaultActionManager: typeof VaultActionManagerKey & {
	readonly layer: typeof vaultActionManagerLayer;
} = Object.assign(VaultActionManagerKey, { layer: vaultActionManagerLayer });

export type VaultActionManagerFactoryResult = {
	readonly dispose: Effect.Effect<void, VamShutdownError>;
	readonly manager: VaultActionManager;
	readonly testing: VaultActionManagerTestingAdapter;
};

/**
 * Builds `VaultActionManager.layer` on a `ManagedRuntime` of its own, for
 * VAM's tests and standalone use outside an Effect runtime. The build is
 * synchronous; when it fails, the runtime is disposed and its
 * `VamSetupError` is thrown. `dispose` closes the runtime, and with it the
 * manager.
 */
export function createVaultActionManager(
	app: App,
	options: VaultActionManagerOptions = {},
): VaultActionManagerFactoryResult {
	const runtime = ManagedRuntime.make(VaultActionManager.layer(app, options));
	const built = runtime.runSyncExit(Effect.service(VaultActionManagerKey));
	if (built._tag === "Failure") {
		void runtime.dispose();
		throw Result.getOrElse(Cause.findError(built.cause), () =>
			setupErrorOf(built.cause),
		);
	}
	const manager = built.value;
	// One disposal for every caller: a second `dispose` waits for the first.
	let disposal: Promise<void> | undefined;
	return {
		dispose: Effect.tryPromise({
			catch: (cause) =>
				new VamShutdownError({ cause, operation: "dispose" }),
			try: () => {
				disposal ??= runtime.dispose();
				return disposal;
			},
		}),
		manager,
		testing: manager.testing,
	};
}

export type {
	DispatchCaller,
	DispatchOptions,
} from "./effect/dispatch-coordinator";
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
	type VamFileReadError,
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
export {
	type DispatchOrUndoOptions,
	dispatchOrUndoVia,
	MAX_PRE_IMAGE_CHARS,
	type VamUndoPort,
} from "./effect/undo-on-failure";
export {
	type VamNotUndoable,
	VamNotUndoableSchema,
	type VamUndoBlock,
	VamUndoBlockSchema,
	type VamUndoProbe,
	VamUndoProbeSchema,
	VamUndoReport,
} from "./effect/undo-report";
