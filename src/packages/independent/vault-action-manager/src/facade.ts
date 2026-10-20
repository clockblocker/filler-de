import { Cause, Effect, Exit } from "effect";
import type { App } from "obsidian";
import {
	type VamActiveEditorError,
	type VamFileAccessError,
	type VamNoActiveEditorError,
	type VamScanError,
	VamShutdownError,
	type VamSubscriptionError,
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
import {
	DispatchBatchCoordinator,
	type DispatchBatchEffectFailure,
	type StopOnFirstFailureDispatchFailure,
} from "./impl/actions-processing/dispatch-batch";
import { Executor } from "./impl/actions-processing/executor";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import {
	type BulkMdModifyEvent,
	type MdFileModification,
	scopeMdModifyEvent,
} from "./impl/event-processing/md-modify-event";
import { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import { VaultObservation } from "./impl/event-processing/vault-observation";
import { VaultReader } from "./impl/vault-reader";
import { splitPathCodec } from "./split-path-codec";
import { VaultActionManagerTestingAdapter } from "./testing-adapter";
import type { VaultFileStat } from "./types/file-stat";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";
import type { VaultScanPathWithStat, VaultScanResult } from "./vault-scan";

export type BulkVaultEventHandler<E = never> = (
	event: BulkVaultEvent,
) => Effect.Effect<void, E>;

export type MdModifyEventHandler<E = never> = (
	event: BulkMdModifyEvent,
) => Effect.Effect<void, E>;

export type VaultActionManagerSubscription = {
	readonly close: Effect.Effect<void, VamRuntimeFailure<never>>;
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

	private readonly dispatches: DispatchBatchCoordinator;
	private readonly markdownFiles: MarkdownFileAccess;
	private readonly mdModifyObservation: VaultObservation<
		MdFileModification,
		BulkMdModifyEvent
	>;
	private readonly observation: VaultObservation;
	private readonly reader: VaultReader;
	private readonly selfEvents: SelfEventTracker;
	private readonly subscriptionClosers = new Set<Effect.Effect<void>>();
	private disposalPromise: Promise<void> | null = null;

	/** @internal Construct through createVaultActionManager. */
	constructor(
		app: App,
		private readonly runtime: VamRuntime,
	) {
		this.selfEvents = successOrThrow(
			this.runtime.runSyncExit(SelfEventTracker.makeEffect()),
			"initialize Self Event tracking",
		);
		const activeEditor = new ActiveFileService();
		const tfileHelper = new TFileHelper(this.selfEvents);
		const tfolderHelper = new TFolderHelper();

		this.markdownFiles = new MarkdownFileAccess(activeEditor, tfileHelper);
		this.reader = new VaultReader(
			this.markdownFiles,
			tfileHelper,
			tfolderHelper,
			(effect) => this.runtime.provide(effect),
		);
		this.observation = successOrThrow(
			this.runtime.runSyncExit(
				VaultObservation.makeEffect(app, this.selfEvents),
			),
			"initialize Vault observation",
		);
		this.mdModifyObservation = successOrThrow(
			this.runtime.runSyncExit(
				VaultObservation.makeMdModifyEffect(app, this.selfEvents),
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
			this.observation.subscribeEffect(this.promiseHandler(handler)),
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
		const scopedHandler = this.promiseHandler(
			(event: BulkMdModifyEvent): Effect.Effect<void, E> => {
				const scoped = scopeMdModifyEvent(event, folder);
				return scoped ? handler(scoped) : Effect.void;
			},
		);
		return this.trackSubscription(
			this.mdModifyObservation.subscribeEffect(scopedHandler),
		);
	}

	private promiseHandler<M, E>(
		handler: (message: M) => Effect.Effect<void, E>,
	): (message: M) => Promise<void> {
		return (message) =>
			this.runtime.runPromiseExit(handler(message)).then((exit) => {
				if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
			});
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
			Effect.map((subscription) => {
				const rawClose = subscription.close;
				this.subscriptionClosers.add(rawClose);
				let active = true;
				return {
					close: Effect.suspend(() => {
						if (!active) return Effect.void;
						active = false;
						this.subscriptionClosers.delete(rawClose);
						return this.runtime.provide(rawClose);
					}),
				};
			}),
		);
	}

	/**
	 * Dispatches one ordered, non-atomic batch. Every planned action is
	 * attempted; failures are reported together after the batch.
	 */
	dispatch(
		actions: readonly VaultAction[],
	): Effect.Effect<void, VamRuntimeFailure<DispatchBatchEffectFailure>> {
		return this.runtime.provide(this.dispatches.dispatchEffect(actions));
	}

	/**
	 * Dispatches one ordered, non-atomic batch that stops at its first failed
	 * action. The `VamDispatchStoppedError` reports the failure, the planned
	 * actions already executed, and the ones skipped. Nothing is rolled back.
	 */
	dispatchStopOnFirstFailure(
		actions: readonly VaultAction[],
	): Effect.Effect<
		void,
		VamRuntimeFailure<StopOnFirstFailureDispatchFailure>
	> {
		return this.runtime.provide(
			this.dispatches.dispatchEffect(actions, {
				stopOnFirstFailure: true,
			}),
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
): VaultActionManagerFactoryResult {
	const runtime = createVamRuntime(makeVamLive(app));
	const manager = new VaultActionManager(app, runtime);
	return {
		dispose: manager.disposeEffect(),
		manager,
		testing: manager.testing,
	};
}

export {
	VamActiveEditorError,
	type VamActiveEditorFailureReason,
	VamActiveEditorFailureReasonSchema,
	VamContentConflictError,
	VamDispatchError,
	VamDispatchOverflowError,
	VamDispatchStoppedError,
	type VamEffectError,
	type VamFileAccessError,
	type VamFileWriteError,
	VamNoActiveEditorError,
	VamPlanningError,
	VamScanError,
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VamVaultIoError,
} from "./effect/errors";
export type {
	DispatchBatchEffectFailure,
	StopOnFirstFailureDispatchFailure,
} from "./impl/actions-processing/dispatch-batch";
