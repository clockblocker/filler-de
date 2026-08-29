import { Cause, Effect, Exit } from "effect";
import type { App } from "obsidian";
import {
	VamShutdownError,
	type VamSubscriptionError,
	VamVaultIoError,
} from "./effect/errors";
import { VaultIo } from "./effect/ports";
import {
	createVamRuntime,
	type VamRuntime,
	type VamRuntimeFailure,
} from "./effect/runtime";
import { makeVamLive } from "./effect/vam-live";
import { ActiveFileService } from "./file-services/active-view/active-file-service";
import type { SelectionInfo } from "./file-services/active-view/selection-service";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import { MarkdownFileAccess } from "./file-services/markdown-file-access";
import { splitPathFromAbstractInternal } from "./helpers/pathfinder/path-codecs/split-and-abstract/split-path-from-abstract";
import {
	DispatchBatchCoordinator,
	type DispatchBatchEffectFailure,
	type ExistenceChecker,
} from "./impl/actions-processing/dispatch-batch";
import { Executor } from "./impl/actions-processing/executor";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import { VaultObservation } from "./impl/event-processing/vault-observation";
import { VaultReader, type VaultReaderReadablePath } from "./impl/vault-reader";
import { splitPathCodec } from "./split-path-codec";
import { VaultActionManagerTestingAdapter } from "./testing-adapter";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export type BulkVaultEventHandler<E = never> = (
	event: BulkVaultEvent,
) => Effect.Effect<void, E>;

export type VaultActionManagerSubscription = {
	readonly close: Effect.Effect<void, VamRuntimeFailure<never>>;
};

export type VaultActionManagerReadableMdPath = SplitPathToMdFile & {
	readonly read: () => Effect.Effect<
		string,
		VamRuntimeFailure<VamVaultIoError>
	>;
};

export type VaultActionManagerReadablePath =
	| VaultActionManagerReadableMdPath
	| SplitPathToFile;

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
		const activeEditor = new ActiveFileService();
		const tfileHelper = new TFileHelper();
		const tfolderHelper = new TFolderHelper();

		this.markdownFiles = new MarkdownFileAccess(activeEditor, tfileHelper);
		this.reader = new VaultReader(
			this.markdownFiles,
			tfileHelper,
			tfolderHelper,
		);
		this.selfEvents = successOrThrow(
			this.runtime.runSyncExit(SelfEventTracker.makeEffect()),
			"initialize Self Event tracking",
		);
		this.observation = successOrThrow(
			this.runtime.runSyncExit(
				VaultObservation.makeEffect(app, this.selfEvents),
			),
			"initialize Vault observation",
		);

		const existenceChecker: ExistenceChecker = {
			exists: (splitPath) => Effect.runPromise(this.exists(splitPath)),
		};
		const executor = new Executor(
			tfileHelper,
			tfolderHelper,
			this.markdownFiles,
		);
		this.dispatches = new DispatchBatchCoordinator(
			executor,
			this.selfEvents,
			existenceChecker,
			this.runtime,
		);
		this.testing = new VaultActionManagerTestingAdapter(
			this.runtime,
			this.dispatches,
			this.observation,
			this.selfEvents,
		);
	}

	startListening(): Effect.Effect<
		void,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		return this.runtime.provide(this.observation.startEffect());
	}

	subscribeToBulk<E>(
		handler: BulkVaultEventHandler<E>,
	): Effect.Effect<
		VaultActionManagerSubscription,
		VamRuntimeFailure<VamSubscriptionError>
	> {
		const promiseHandler = (event: BulkVaultEvent): Promise<void> =>
			this.runtime.runPromiseExit(handler(event)).then((exit) => {
				if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
			});

		return this.runtime
			.provide(this.observation.subscribeEffect(promiseHandler))
			.pipe(
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

	dispatch(
		actions: readonly VaultAction[],
	): Effect.Effect<void, VamRuntimeFailure<DispatchBatchEffectFailure>> {
		return this.runtime.provide(this.dispatches.dispatchEffect(actions));
	}

	readContent(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<string, VamRuntimeFailure<VamVaultIoError>> {
		return this.runtime.provide(this.reader.readContent(splitPath));
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

	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Effect.Effect<
		VaultActionManagerReadablePath[],
		VamRuntimeFailure<VamVaultIoError>
	> {
		return this.runtime
			.provide(this.reader.listAllFilesWithMdReaders(splitPath))
			.pipe(
				Effect.map((paths) =>
					paths.map((path) => this.provideReader(path)),
				),
			);
	}

	mdPwd(): Effect.Effect<SplitPathToMdFile | null, VamRuntimeFailure<never>> {
		return this.runtime.provide(this.markdownFiles.activeMdPath());
	}

	getOpenedContent(): Effect.Effect<
		string,
		VamRuntimeFailure<VamVaultIoError>
	> {
		return this.runtime.provide(this.markdownFiles.openedContent());
	}

	getSelectionInfo(): Effect.Effect<
		SelectionInfo | null,
		VamRuntimeFailure<never>
	> {
		return this.runtime.provide(this.markdownFiles.selectionInfo());
	}

	getSelectionText(): Effect.Effect<string | null, VamRuntimeFailure<never>> {
		return this.runtime.provide(this.markdownFiles.selectionText());
	}

	cd(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<void, VamRuntimeFailure<VamVaultIoError>> {
		return this.runtime.provide(this.markdownFiles.open(splitPath));
	}

	scrollOpenedFileToLine(
		line: number,
	): Effect.Effect<void, VamRuntimeFailure<VamVaultIoError>> {
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

	private provideReader(
		path: VaultReaderReadablePath,
	): VaultActionManagerReadablePath {
		if (!("read" in path)) return path;
		return {
			...path,
			read: () => this.runtime.provide(path.read()),
		};
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
	VamDispatchError,
	type VamEffectError,
	VamPlanningError,
	VamSetupError,
	VamShutdownError,
	VamSubscriptionError,
	VamVaultIoError,
} from "./effect/errors";
