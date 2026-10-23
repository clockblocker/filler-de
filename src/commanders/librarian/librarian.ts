import type {
	LeafMatch,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "@textfresser/library-core";
import {
	type BulkInterpreter,
	type ChangeNodeStatusAction,
	type CodecRules,
	type Codecs,
	type CodexClickTarget,
	Healer,
	isCodexInsideLibrary as isCodexInsideLibraryHelper,
	isCodexSplitPath,
	makeBulkInterpreter,
	makeCodecRulesFromSettings,
	makeCodecs,
	makeLibraryScope,
	type NodeName,
	PREFIX_OF_CODEX,
	parseCodexClickLineContent,
	Tree,
	TreeNodeKind,
	TreeNodeStatus,
} from "@textfresser/library-core";
import type { PayloadFor } from "@textfresser/obsidian-event-layer";
import type {
	BulkVaultEvent,
	VamScanError,
	VaultActionManager,
	VaultScanResult,
	VaultSnapshotSubscription,
} from "@textfresser/vault-action-manager";
import {
	type AnySplitPath,
	MD,
	type SplitPathToMdFile,
} from "@textfresser/vault-action-manager";
import {
	Cause,
	Data,
	Deferred,
	Effect,
	Exit,
	Option,
	Ref,
	Result,
	type Scope,
} from "effect";
import type {
	CommandContext,
	CommandKind,
} from "../../managers/obsidian/command-executor";
import type { SettingsService } from "../../settings/settings-service";
import { metadataFormatOf } from "../../stateless-helpers/note-metadata";
import { catchWhole, causeMessages } from "../../utils/causes";
import { IdleTracker } from "../../utils/idle-tracker";
import { commandFnForCommandKind } from "./commands";
import type {
	CommandError,
	LibrarianCommandInput,
	LibrarianCommandKind,
} from "./commands/types";
import { buildInitialCreateActions } from "./init";
import { listCommandsExecutableIn as listCommandsExecutableInImpl } from "./navigation/list-commands-executable";
import {
	getNextPage as getNextPageImpl,
	getPrevPage as getPrevPageImpl,
} from "./navigation/page-navigation";
import { resolveAliasFromSuffix } from "./navigation/wikilink-alias";
import type { PageSplitPlan } from "./pages/build-actions";
import {
	describeLibrarianStop,
	describeMissingLibraryRoot,
	isMissingLibraryRoot,
	type LibrarianStopPhase,
} from "./runtime/describe-librarian-stop";
import {
	type LibrarianStop,
	LibrarianStopped,
	LibraryRootMissing,
} from "./runtime/librarian-stop";
import {
	classifyVamDispatchFailure,
	LibraryReconciler,
	ReconciliationAuditLog,
	type ReconciliationOutcome,
	type ReconciliationRecoveryInput,
	type ReconciliationRequest,
} from "./runtime/library-reconciliation";
import { logLibraryIssues } from "./runtime/log-library-issues";
import { VaultActionQueue } from "./runtime/vault-action-queue";

// ─── Queue Item ───

type LibraryCommandIntention = Pick<
	PageSplitPlan,
	"treeActions" | "vaultActions"
> & {
	readonly operationId: string;
};

type ReconciliationQueueItem = {
	readonly kind: "Reconciliation";
	readonly request: ReconciliationRequest;
};

/** A bulk VAM delivered, interpreted only when its turn comes. */
type ObservedBulkQueueItem = {
	readonly bulk: BulkVaultEvent;
	readonly kind: "ObservedBulk";
};

export type LibrarianVam = Pick<
	VaultActionManager,
	| "cd"
	| "dispatch"
	| "getActiveEditorContext"
	| "getOpenedContent"
	| "mdPwd"
	| "scanAndSubscribe"
>;

/** A dispatch that died or was interrupted; `cause` holds every reason. */
class LibrarianUnexpectedDispatchError extends Data.TaggedError(
	"LibrarianUnexpectedDispatchError",
)<{
	readonly cause: Cause.Cause<never>;
	readonly operation: "dispatch";
}> {
	override get message(): string {
		return `${this.operation}: ${causeMessages(this.cause)}`;
	}
}

/** A recovery rescan that died or was interrupted; `cause` holds every reason. */
class LibrarianUnexpectedRecoveryError extends Data.TaggedError(
	"LibrarianUnexpectedRecoveryError",
)<{
	readonly cause: Cause.Cause<never>;
	readonly operation: "scan";
}> {}

type LibrarianDispatchFailure =
	| Effect.Error<ReturnType<LibrarianVam["dispatch"]>>
	| LibrarianUnexpectedDispatchError;

function classifyLibrarianDispatchFailure(
	failure: LibrarianDispatchFailure,
): "FailedBeforeExecution" | "ExecutionUncertain" {
	return failure instanceof LibrarianUnexpectedDispatchError
		? "ExecutionUncertain"
		: classifyVamDispatchFailure(failure);
}

type LibrarianRecoveryFailure =
	| Effect.Error<VaultSnapshotSubscription["rescan"]>
	| LibrarianUnexpectedRecoveryError
	| {
			readonly diagnostics: VaultScanResult["diagnostics"];
			readonly kind: "PartialVaultScan";
	  };

export type LibrarianReconciliationOutcome = ReconciliationOutcome<
	LibrarianDispatchFailure,
	LibrarianRecoveryFailure
>;

export type LibraryCommandIntentionResult =
	| {
			readonly initialDispatch: {
				readonly kind: "Completed";
				readonly submittedCount: number;
			};
			readonly kind: "Completed";
			readonly operationId: string;
			readonly outcome: LibrarianReconciliationOutcome;
	  }
	| {
			readonly initialDispatch: {
				readonly kind: "Completed";
				readonly submittedCount: number;
			};
			readonly kind: "ReconciliationFailed";
			readonly operationId: string;
			readonly outcome: LibrarianReconciliationOutcome;
	  }
	| {
			readonly failure: LibrarianDispatchFailure;
			readonly kind: "VaultDispatchFailed";
			readonly operationId: string;
			readonly outcome: LibrarianReconciliationOutcome;
	  };

export class LibraryCommandIntentionError extends Data.TaggedError(
	"LibraryCommandIntentionError",
)<{ readonly kind: "LibrarianUnavailable" }> {}

export type { LibrarianStop } from "./runtime/librarian-stop";
export { LibrarianStopped, LibraryRootMissing } from "./runtime/librarian-stop";

/**
 * What stopped the Librarian: what its start failed with, before or while
 * reconciling, or the reconciliation that failed past recovery later on.
 */
export type LibrarianStopFailure =
	| Effect.Error<ReturnType<LibrarianVam["scanAndSubscribe"]>>
	| Effect.Error<VaultSnapshotSubscription["start"]>
	| LibrarianRecoveryFailure
	| LibrarianReconciliationOutcome;

/** What the Librarian's `unsubscribe` fails with. */
export type LibrarianUnsubscribeFailure = Effect.Error<
	VaultSnapshotSubscription["close"]
>;

export type LibrarianOptions = {
	/**
	 * Where the Librarian reads its settings: each start runs under the
	 * settings in effect as it begins, and recovers under the same ones.
	 * Only the metadata format is read as each note is written (see
	 * `CodecRules.metadataFormat`).
	 */
	readonly settings: Pick<SettingsService, "get" | "now">;
	/**
	 * Told when the Librarian stops: its startup failed, or a later
	 * reconciliation failed past recovery.
	 */
	readonly onStopped?: (stop: LibrarianStop) => void;
};

/** Logs a warning for each of `diagnostics`, its data annotated. */
const logEach = (
	diagnostics: readonly unknown[],
	message: string,
): Effect.Effect<void> =>
	Effect.forEach(
		diagnostics,
		(diagnostic) =>
			Effect.logWarning(message).pipe(
				Effect.annotateLogs({ diagnostic }),
			),
		{ discard: true },
	);

// ─── State ───

type LibrarianReconciler = LibraryReconciler<
	LibrarianDispatchFailure,
	LibrarianRecoveryFailure
>;

/**
 * Where a Librarian is in its one life:
 * - `Idle`: made, its start not yet begun;
 * - `Starting`: its start runs, and VAM holds the vault changes after its
 *   snapshot;
 * - `Running`: started; vault changes, clicks and commands reach its queue;
 * - `Closed`: its scope closed, or its start failed. It takes no new work;
 *   the work already queued still runs.
 */
type LibrarianStatus = "Idle" | "Starting" | "Running" | "Closed";

/** What a start builds from its snapshot, together: its Tree and its queue. */
type LibrarianHealing = {
	readonly reconciler: LibrarianReconciler;
	/** Every reconciliation runs in it, alone and in turn. */
	readonly queue: VaultActionQueue;
};

/**
 * Everything one Librarian holds, as one value in a `Ref`. Its start
 * writes it, its scope's close ends it, and every reader takes a snapshot.
 */
type LibrarianState = {
	readonly status: LibrarianStatus;
	/** Built from the settings its start read; null before. */
	readonly codecs: Codecs | null;
	readonly interpretBulk: BulkInterpreter | null;
	/**
	 * The Library's snapshot and the vault changes after it. Kept after the
	 * scope closes it, so a reconciliation still running can rescan.
	 */
	readonly subscription: VaultSnapshotSubscription | null;
	readonly healing: LibrarianHealing | null;
	/** The last split's number: each command names its operation by it. */
	readonly commandCount: number;
	/** What the start's scan could not read. */
	readonly lastScanDiagnostics: readonly VamScanError[];
	/** How closing its scope unsubscribed it, once it closed. */
	readonly unsubscribed: Exit.Exit<void, LibrarianUnsubscribeFailure> | null;
};

const NOT_STARTED: LibrarianState = {
	codecs: null,
	commandCount: 0,
	healing: null,
	interpretBulk: null,
	lastScanDiagnostics: [],
	status: "Idle",
	subscription: null,
	unsubscribed: null,
};

/** Its reconciler and queue while it runs: what new work needs; none otherwise. */
const runningHealing = (state: LibrarianState): LibrarianHealing | null =>
	state.status === "Running" ? state.healing : null;

// ─── Librarian ───

/**
 * Keeps one Library healed, from one start to the close of the scope it was
 * made in (`Librarian.make`). Closing that scope unsubscribes it: it takes
 * no new work, its VAM subscription closes, and the work queued before
 * runs to its end. A new start is a new Librarian.
 */
export class Librarian {
	private readonly reconciliationAudit = new ReconciliationAuditLog<
		LibrarianDispatchFailure,
		LibrarianRecoveryFailure
	>();

	private constructor(
		private readonly vam: LibrarianVam,
		private readonly options: LibrarianOptions,
		private readonly state: Ref.Ref<LibrarianState>,
		/** Done once its start ended, started or not, or its scope closed. */
		private readonly startEnded: Deferred.Deferred<void>,
	) {}

	/**
	 * A Librarian in the current scope, not yet started: `init` starts it,
	 * and closing the scope unsubscribes it.
	 */
	static readonly make = Effect.fnUntraced(function* (
		vam: LibrarianVam,
		options: LibrarianOptions,
	): Effect.fn.Return<Librarian, never, Scope.Scope> {
		const librarian = new Librarian(
			vam,
			options,
			yield* Ref.make(NOT_STARTED),
			yield* Deferred.make<void>(),
		);
		yield* Effect.addFinalizer(() => librarian.release());
		return librarian;
	});

	/** The last reconciliation's outcome (for testing). */
	get _debugLastReconciliationOutcome(): LibrarianReconciliationOutcome | null {
		return this.reconciliationAudit.getRecent(1)[0] ?? null;
	}

	/** What the start's scan could not read (for testing). */
	get _debugLastScanDiagnostics(): readonly VamScanError[] {
		return this.snapshot().lastScanDiagnostics;
	}

	/** The codec rules this Librarian's start runs under; null before its start read them. */
	get codecRules(): CodecRules | null {
		return this.snapshot().codecs?.rules ?? null;
	}

	/** The state as it is now, for the plain code that reads it synchronously. */
	private snapshot(): LibrarianState {
		return Ref.getUnsafe(this.state);
	}

	/**
	 * The state once this Librarian's start ended: a click or a command
	 * that comes while it starts waits for it, so a half-started Librarian
	 * never takes work.
	 */
	private readonly afterStart: Effect.Effect<LibrarianState> = Effect.gen(
		{ self: this },
		function* () {
			const now = yield* Ref.get(this.state);
			if (now.status !== "Starting") return now;
			yield* Deferred.await(this.startEnded);
			return yield* Ref.get(this.state);
		},
	);

	/**
	 * Tells `onStopped` why the Librarian stopped, and logs it with every
	 * reason in `cause`. At startup, a vault without its Library folder,
	 * and nothing else, is a `LibraryRootMissing`.
	 */
	private reportStopped(
		phase: LibrarianStopPhase,
		cause: Cause.Cause<LibrarianStopFailure>,
	): Effect.Effect<LibrarianStop> {
		return Effect.suspend(() => {
			const missing =
				phase === "Startup" ? missingLibraryRoot(cause) : undefined;
			if (missing) {
				const stop = new LibraryRootMissing({
					cause: missing,
					message: describeMissingLibraryRoot(missing),
				});
				return Effect.logWarning(
					`[Librarian] ${stop.message}`,
					cause,
				).pipe(Effect.andThen(this.tellStopped(stop)));
			}
			const stop = new LibrarianStopped({
				cause,
				message: describeLibrarianStop(phase, cause),
				phase,
			});
			return Effect.logError(
				`[Librarian] Stopped. ${stop.message}`,
				cause,
			).pipe(Effect.andThen(this.tellStopped(stop)));
		});
	}

	private tellStopped(stop: LibrarianStop): Effect.Effect<LibrarianStop> {
		return Effect.sync(() => {
			this.options.onStopped?.(stop);
			return stop;
		});
	}

	private prepareStartupReconciliation(
		scan: VaultScanResult,
		codecs: Codecs,
		allowPartial: boolean,
	): Effect.Effect<ReconciliationRecoveryInput, LibrarianRecoveryFailure> {
		if (!allowPartial && scan.kind === "Partial") {
			return Effect.fail({
				diagnostics: scan.diagnostics,
				kind: "PartialVaultScan",
			});
		}

		return buildInitialCreateActions(scan.entries, codecs).pipe(
			Effect.tap(({ createDiagnostics }) =>
				logEach(
					createDiagnostics,
					"[Librarian] Invalid startup Create observation",
				),
			),
			Effect.map(({ createActions }) => ({
				healer: new Healer(
					new Tree(codecs.rules.libraryRootName, codecs),
					codecs,
				),
				request: {
					observedVaultPaths: scan.entries,
					source: "Startup",
					supplemental: { invalidCodexDeletions: [] },
					treeActions: createActions,
				},
			})),
		);
	}

	private readonly prepareRecovery = Effect.fn("Librarian.prepareRecovery")(
		function* (this: Librarian) {
			const { codecs, status, subscription } = yield* Ref.get(this.state);
			if (!subscription || !codecs) {
				return yield* new LibrarianUnexpectedRecoveryError({
					cause: Cause.die(
						new Error("The Librarian has no Library snapshot"),
					),
					operation: "scan",
				});
			}
			// The rescan moves VAM's cursor: changes it holds that were not
			// yet delivered never are, and `afterSnapshot` trims a bulk that
			// waited in the queue meanwhile.
			const scan = yield* subscription.rescan;
			// Startup accepted a partial scan, so its recovery does too.
			return yield* this.prepareStartupReconciliation(
				scan,
				codecs,
				status === "Starting",
			);
		},
	);

	private makeReconciler(
		healer: Healer,
		codecs: Codecs,
	): LibrarianReconciler {
		return new LibraryReconciler(healer, codecs, {
			audit: this.reconciliationAudit,
			classifyDispatchFailure: classifyLibrarianDispatchFailure,
			dispatch: (actions) =>
				this.vam.dispatch(actions, { caller: "librarian" }),
			recover: () => this.prepareRecovery(),
			unexpectedDispatchFailure: (cause) =>
				new LibrarianUnexpectedDispatchError({
					cause,
					operation: "dispatch",
				}),
			unexpectedRecoveryFailure: (cause) =>
				new LibrarianUnexpectedRecoveryError({
					cause,
					operation: "scan",
				}),
		});
	}

	/**
	 * Initialize librarian: read tree and heal mismatches. A Librarian
	 * starts once. A start that fails fails with the Librarian's typed
	 * stop, holding every reason, and tells `onStopped` it too; the
	 * Librarian is then closed.
	 */
	readonly init = Effect.fn("Librarian.init")(function* (
		this: Librarian,
	): Effect.fn.Return<void, LibrarianStop> {
		const begun = yield* Ref.modify(
			this.state,
			(state): [boolean, LibrarianState] =>
				state.status === "Idle"
					? [true, { ...state, status: "Starting" }]
					: [false, state],
		);
		if (!begun) {
			// Not a stop: the Librarian that runs, or closed, stays as it is.
			return yield* Effect.die(
				new Error(
					"A Librarian starts once, and never after its scope closed",
				),
			);
		}
		const idle = yield* IdleTracker;
		return yield* idle.track(this.start()).pipe(
			// What stopped the start, every reason of it, as the typed stop.
			catchWhole((cause) =>
				this.reportStopped("Startup", cause).pipe(
					Effect.flatMap(Effect.fail),
				),
			),
			Effect.onError(() => this.close().pipe(Effect.ignore)),
			Effect.ensuring(Deferred.done(this.startEnded, Exit.void)),
		);
	});

	private readonly start = Effect.fnUntraced(function* (
		this: Librarian,
	): Effect.fn.Return<void, LibrarianStopFailure> {
		const settings = yield* this.options.settings.get;
		const codecs = makeCodecs(
			makeCodecRulesFromSettings(settings, {
				metadataFormat: () =>
					metadataFormatOf(this.options.settings.now()),
			}),
		);
		yield* Ref.update(this.state, (state) => ({
			...state,
			codecs,
			interpretBulk: makeBulkInterpreter(codecs),
		}));

		// The snapshot and the subscription share one cursor: every vault
		// change after the snapshot reaches handleBulkEvent once, and none
		// it holds does. VAM holds them until `start`, below.
		// External events only: the Librarian's own renames, and every
		// other caller's, are never healed again.
		const subscription = yield* this.vam
			.scanAndSubscribe(
				settings.splitPathToLibraryRoot,
				{ onBulk: (bulk) => this.handleBulkEvent(bulk) },
				{ from: "external" },
			)
			.pipe(
				Effect.tapError((failure) =>
					Effect.logError(
						"[Librarian] Vault scan failed:",
						Cause.fail(failure),
					),
				),
			);
		const scan = subscription.snapshot;
		const kept = yield* Ref.modify(
			this.state,
			(state): [boolean, LibrarianState] =>
				state.status === "Starting"
					? [
							true,
							{
								...state,
								lastScanDiagnostics: scan.diagnostics,
								subscription,
							},
						]
					: [false, state],
		);
		if (!kept) {
			// Its scope closed while it subscribed: nothing else closes this.
			yield* subscription.close.pipe(Effect.ignore);
			return yield* Effect.interrupt;
		}
		if (scan.kind === "Partial")
			yield* Effect.forEach(
				scan.diagnostics,
				(diagnostic) =>
					Effect.logWarning(
						`[Librarian] Partial vault scan at ${diagnostic.path}`,
					).pipe(Effect.annotateLogs({ diagnostic })),
				{ discard: true },
			);

		const startup = yield* this.prepareStartupReconciliation(
			scan,
			codecs,
			true,
		);
		const healing: LibrarianHealing = {
			queue: yield* VaultActionQueue.make,
			reconciler: this.makeReconciler(startup.healer, codecs),
		};
		yield* Ref.update(this.state, (state) => ({ ...state, healing }));

		const startupOutcome = yield* healing.queue.run(
			this.processQueueItem(healing, {
				kind: "Reconciliation",
				request: startup.request,
			}),
		);
		if (
			startupOutcome?.status === "Failed" ||
			startupOutcome?.status === "PartialFailure"
		) {
			if (startupOutcome.recovery.kind !== "Resynchronized") {
				return yield* Effect.fail(startupOutcome);
			}
			yield* Effect.logWarning(
				"[Librarian] Startup healing partly failed; a rescan of the library recovered it",
			).pipe(Effect.annotateLogs({ outcome: startupOutcome }));
		}

		const running = yield* Ref.modify(
			this.state,
			(state): [boolean, LibrarianState] =>
				state.status === "Starting"
					? [true, { ...state, status: "Running" }]
					: [false, state],
		);
		if (!running) return yield* Effect.interrupt;
		// The changes after the latest snapshot, the first or a recovery's
		// rescan, now reach handleBulkEvent.
		yield* subscription.start;
	});

	/**
	 * Its scope's finalizer: closes the Librarian, and keeps how that ended
	 * for `unsubscribed`.
	 */
	private readonly release = Effect.fn("Librarian.unsubscribe")(function* (
		this: Librarian,
	) {
		const exit = yield* Effect.exit(this.close());
		yield* Ref.update(this.state, (state) => ({
			...state,
			unsubscribed: exit,
		}));
	});

	/**
	 * How closing its scope unsubscribed it: none before the scope closed.
	 * The supervisor reads it to tell a release that failed.
	 */
	readonly unsubscribed: Effect.Effect<
		Option.Option<Exit.Exit<void, LibrarianUnsubscribeFailure>>
	> = Effect.sync(() => Option.fromNullishOr(this.snapshot().unsubscribed));

	/**
	 * Takes no new work, closes the subscription, and waits for the work
	 * already queued. Closing twice closes nothing more.
	 */
	private readonly close = Effect.fnUntraced(function* (this: Librarian) {
		const { healing, subscription } = yield* Ref.updateAndGet(
			this.state,
			(state) => ({ ...state, status: "Closed" as const }),
		);
		yield* Deferred.done(this.startEnded, Exit.void);
		const drain = healing ? healing.queue.waitForDrain() : Effect.void;
		if (subscription) {
			yield* subscription.close.pipe(Effect.ensuring(drain));
			return;
		}
		yield* drain;
	});

	/**
	 * Handle a bulk event: queue it, to be turned into tree actions and
	 * healed in its turn. VAM delivers only once the start ended; a bulk
	 * that comes when the Librarian is not running is dropped, since the
	 * next start's scan holds it.
	 */
	private readonly handleBulkEvent = Effect.fn("Librarian.handleBulkEvent")(
		function* (this: Librarian, bulk: BulkVaultEvent) {
			yield* Effect.annotateCurrentSpan({
				"librarian.bulk.events": bulk.events.length,
				"librarian.bulk.roots": bulk.roots.length,
			});
			const state = yield* Ref.get(this.state);
			const healing = runningHealing(state);
			if (!healing) {
				yield* Effect.logWarning(
					`[Librarian.handleBulkEvent] The Librarian is ${state.status}; the next start's scan holds this change`,
				);
				return;
			}
			yield* healing.queue.run(
				this.processQueueItem(healing, { bulk, kind: "ObservedBulk" }),
			);
		},
	);

	/**
	 * The reconciliation a queued bulk asks for, or null when it asks for
	 * none. Interpreted in its turn, so a rescan that ran while it waited,
	 * and holds part of it, leaves only the rest. What the interpretation
	 * could not translate is logged.
	 */
	private readonly observedBulkRequest = Effect.fnUntraced(function* (
		this: Librarian,
		bulk: BulkVaultEvent,
	): Effect.fn.Return<ReconciliationRequest | null> {
		const { interpretBulk, subscription } = yield* Ref.get(this.state);
		if (!interpretBulk) return null;
		const current = subscription ? subscription.afterSnapshot(bulk) : bulk;
		if (!current) return null;
		const { createDiagnostics, invalidCodexActions, issues, treeActions } =
			interpretBulk(current);
		yield* logEach(
			createDiagnostics,
			"[Librarian] Invalid live Create observation",
		);
		yield* logLibraryIssues(issues);
		if (treeActions.length === 0 && invalidCodexActions.length === 0) {
			return null;
		}
		return {
			source: "ObservedBulk",
			supplemental: { invalidCodexDeletions: invalidCodexActions },
			treeActions,
		};
	});

	/**
	 * Reconciles a queued item in its turn; answers its outcome, or null
	 * when a bulk asked for nothing.
	 */
	private readonly processQueueItem = Effect.fn("Librarian.processQueueItem")(
		function* (
			this: Librarian,
			{ reconciler }: LibrarianHealing,
			queued: ReconciliationQueueItem | ObservedBulkQueueItem,
		): Effect.fn.Return<LibrarianReconciliationOutcome | null> {
			const request =
				queued.kind === "ObservedBulk"
					? yield* this.observedBulkRequest(queued.bulk)
					: queued.request;
			if (!request) return null;

			const wasUnavailable = reconciler.isUnavailable();
			const outcome = yield* reconciler.reconcile(request);
			if (
				outcome.status === "Failed" ||
				outcome.status === "PartialFailure"
			) {
				yield* Effect.logError(
					"[Librarian] Reconciliation failed",
				).pipe(Effect.annotateLogs({ outcome }));
			}
			// A failed startup is reported once, by init.
			if (request.source !== "Startup") {
				yield* this.reportIfNewlyStopped(
					reconciler,
					wasUnavailable,
					outcome,
				);
			}
			return outcome;
		},
	);

	private reportIfNewlyStopped(
		reconciler: LibrarianReconciler,
		wasUnavailable: boolean,
		outcome: LibrarianReconciliationOutcome,
	): Effect.Effect<void> {
		return Effect.suspend(() =>
			!wasUnavailable && reconciler.isUnavailable()
				? this.reportStopped("Runtime", Cause.fail(outcome)).pipe(
						Effect.asVoid,
					)
				: Effect.void,
		);
	}

	private readonly processCommandIntention = Effect.fn(
		"Librarian.processCommandIntention",
	)(function* (
		this: Librarian,
		{ reconciler }: LibrarianHealing,
		intention: LibraryCommandIntention,
	): Effect.fn.Return<LibraryCommandIntentionResult> {
		const wasUnavailable = reconciler.isUnavailable();
		const dispatchResult = yield* this.vam
			// The command's operation id names its batch too, so the split's
			// record, its VAM report and its spans share one id.
			.dispatch(intention.vaultActions, {
				caller: "librarian",
				operationId: intention.operationId,
			})
			.pipe(
				Effect.mapError((failure): LibrarianDispatchFailure => failure),
				Effect.result,
				Effect.catchCause((cause) =>
					Effect.succeed<
						Result.Result<void, LibrarianDispatchFailure>
					>(
						Result.fail(
							new LibrarianUnexpectedDispatchError({
								cause,
								operation: "dispatch",
							}),
						),
					),
				),
			);
		if (Result.isFailure(dispatchResult)) {
			const outcome = yield* reconciler.reconcileExternalDispatchFailure({
				failure: dispatchResult.failure,
				operationId: intention.operationId,
				source: "CommandIntention",
				submittedCount: intention.vaultActions.length,
			});
			yield* Effect.logError(
				"[Librarian] Command intention vault dispatch failed",
			).pipe(Effect.annotateLogs({ outcome }));
			yield* this.reportIfNewlyStopped(
				reconciler,
				wasUnavailable,
				outcome,
			);
			return {
				failure: dispatchResult.failure,
				kind: "VaultDispatchFailed",
				operationId: intention.operationId,
				outcome,
			};
		}

		const outcome = yield* reconciler.reconcile({
			operationId: intention.operationId,
			source: "CommandIntention",
			supplemental: { invalidCodexDeletions: [] },
			treeActions: intention.treeActions,
		});
		const initialDispatch = {
			kind: "Completed",
			submittedCount: intention.vaultActions.length,
		} as const;
		if (
			outcome.status === "Failed" ||
			outcome.status === "PartialFailure"
		) {
			yield* Effect.logError(
				"[Librarian] Command intention reconciliation failed",
			).pipe(Effect.annotateLogs({ outcome }));
			yield* this.reportIfNewlyStopped(
				reconciler,
				wasUnavailable,
				outcome,
			);
			return {
				initialDispatch,
				kind: "ReconciliationFailed",
				operationId: intention.operationId,
				outcome,
			};
		}
		return {
			initialDispatch,
			kind: "Completed",
			operationId: intention.operationId,
			outcome,
		};
	});

	/**
	 * Get current healer (for testing).
	 */
	getHealer(): Healer | null {
		return this.snapshot().healing?.reconciler.getCommittedHealer() ?? null;
	}

	getRecentReconciliationOutcomes(
		count = 10,
	): readonly LibrarianReconciliationOutcome[] {
		return this.reconciliationAudit.getRecent(count);
	}

	/**
	 * Execute a validated page-split batch and its Tree intention under one
	 * permit, and answer how it went. One that comes while the Librarian
	 * starts waits for its start; a Librarian that is not running refuses it.
	 */
	readonly executeSplitIntention = Effect.fn(
		"Librarian.executeSplitIntention",
	)(function* (
		this: Librarian,
		plan: PageSplitPlan,
	): Effect.fn.Return<
		LibraryCommandIntentionResult,
		LibraryCommandIntentionError
	> {
		const healing = runningHealing(yield* this.afterStart);
		if (!healing) {
			return yield* new LibraryCommandIntentionError({
				kind: "LibrarianUnavailable",
			});
		}
		const operationId = yield* Ref.modify(
			this.state,
			(state): [string, LibrarianState] => [
				`split-${state.commandCount + 1}`,
				{ ...state, commandCount: state.commandCount + 1 },
			],
		);
		return yield* healing.queue.run(
			this.processCommandIntention(healing, {
				operationId,
				treeActions: plan.treeActions,
				vaultActions: plan.vaultActions,
			}).pipe(Effect.uninterruptible),
		);
	});

	/** The Library scope and Tree of this Librarian's start, once it built them. */
	private libraryView() {
		const { codecs, healing } = this.snapshot();
		if (!codecs || !healing) return null;
		return {
			codecs,
			healer: healing.reconciler.getCommittedHealer(),
			libraryScope: makeLibraryScope(codecs.rules),
		};
	}

	/**
	 * Get previous page by looking up siblings in tree.
	 * Returns null if current is first page or not a page file.
	 */
	getPrevPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		const view = this.libraryView();
		if (!view) return null;
		const libraryPath = view.libraryScope.toLibraryPath(currentFilePath);
		if (libraryPath.isErr()) return null;
		const previous = getPrevPageImpl(
			view.healer,
			view.codecs,
			libraryPath.value,
		);
		return previous ? view.libraryScope.toVaultPath(previous) : null;
	}

	/**
	 * Get next page by looking up siblings in tree.
	 * Returns null if current is last page or not a page file.
	 */
	getNextPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		const view = this.libraryView();
		if (!view) return null;
		const libraryPath = view.libraryScope.toLibraryPath(currentFilePath);
		if (libraryPath.isErr()) return null;
		const next = getNextPageImpl(
			view.healer,
			view.codecs,
			libraryPath.value,
		);
		return next ? view.libraryScope.toVaultPath(next) : null;
	}

	/**
	 * List all commands that could be executable for a given file path.
	 * Returns all possible commands for the file type; caller filters by selection state.
	 * None before the start read its settings.
	 */
	listCommandsExecutableIn(splitPath: SplitPathToMdFile): CommandKind[] {
		const { codecs, healing } = this.snapshot();
		if (!codecs) return [];
		const libraryPath = makeLibraryScope(codecs.rules).toLibraryPath(
			splitPath,
		);
		if (libraryPath.isErr()) return [];
		return listCommandsExecutableInImpl(
			codecs,
			healing?.reconciler.getCommittedHealer() ?? null,
			libraryPath.value,
		);
	}

	/**
	 * Execute a librarian command.
	 * Handles codex guard internally - nav commands allowed on codex, others silently skip.
	 */
	executeCommand(
		commandName: LibrarianCommandKind,
		context: CommandContext,
		notify: (message: string) => void,
	): Effect.Effect<void, CommandError> {
		if (!context.activeFile) {
			return Effect.fail({ kind: "NotMdFile" });
		}

		// Codex guard - only nav commands allowed on codex files
		const isNavCommand =
			commandName === "GoToPrevPage" || commandName === "GoToNextPage";
		if (!isNavCommand && isCodexSplitPath(context.activeFile.splitPath)) {
			return Effect.void; // silently skip
		}

		const commandFn = commandFnForCommandKind[commandName];
		const input: LibrarianCommandInput = {
			commandContext: { ...context, activeFile: context.activeFile },
			librarianState: { librarian: this, notify, vam: this.vam },
		};

		return commandFn(input).pipe(
			Effect.tapError((error) =>
				Effect.logWarning(
					`[Librarian.${commandName}] Failed:`,
					Cause.fail(error),
				),
			),
		);
	}

	/** Whether a path is a Codex inside the Library; false before the start read the root. */
	isCodexInsideLibrary(splitPath: SplitPathToMdFile): boolean {
		const { codecs } = this.snapshot();
		return codecs
			? isCodexInsideLibraryHelper(splitPath, codecs.rules)
			: false;
	}

	/**
	 * Whether a vault path is the Library root folder or lies under it.
	 * False until init has read the configured root.
	 */
	isInsideLibrary(splitPath: AnySplitPath): boolean {
		const { codecs } = this.snapshot();
		return codecs
			? codecs.splitPathInsideLibrary.checkIfInsideLibrary(splitPath)
			: false;
	}

	/** Whether a path names a codex file (basename carries the codex prefix). */
	isCodex(splitPath: AnySplitPath): boolean {
		return isCodexSplitPath(splitPath);
	}

	resolveWikilinkAlias(linkContent: string): string | null {
		const { codecs } = this.snapshot();
		if (!codecs) return null;
		const result = resolveAliasFromSuffix(
			linkContent,
			codecs.suffix,
			(name) => name.startsWith(PREFIX_OF_CODEX),
		);
		return result?.alias ?? null;
	}

	/**
	 * Find all leaves in the library tree matching a corename.
	 * Returns empty array if healer not initialized or no matches.
	 */
	findMatchingLeavesByCoreName(coreName: string): LeafMatch[] {
		const healer = this.getHealer();
		if (!healer) return [];
		return healer.getLeavesByCoreName(coreName);
	}

	parseLibraryBasename(
		basename: string,
	): { coreName: string; suffixParts: string[] } | null {
		const { codecs } = this.snapshot();
		if (!codecs) return null;
		const parsed = codecs.suffix.parseSeparatedSuffix(basename);
		if (Result.isFailure(parsed)) {
			return null;
		}
		return {
			coreName: parsed.success.coreName,
			suffixParts: [...parsed.success.suffixParts],
		};
	}

	/**
	 * Handle checkbox click in a codex file.
	 * Parses the line content to determine the target (scroll or section),
	 * builds a ChangeNodeStatusAction, and reconciles it in its turn. A
	 * click while the Librarian starts waits for its start.
	 */
	readonly handleCodexCheckboxClick = Effect.fn(
		"Librarian.handleCodexCheckboxClick",
	)(function* (this: Librarian, payload: PayloadFor<"CheckboxClicked">) {
		const state = yield* this.afterStart;
		const healing = runningHealing(state);
		const { codecs } = state;
		if (!healing || !codecs) {
			yield* Effect.logWarning(
				`[Librarian.handleCodexCheckboxClick] The Librarian is ${state.status}`,
			);
			return;
		}

		// 1. Parse line content to get click target
		const parseResult = parseCodexClickLineContent(
			payload.lineContent,
			codecs,
		);
		if (parseResult.isErr()) {
			yield* Effect.logWarning(
				"[Librarian.handleCodexCheckboxClick] Parse failed:",
				Cause.fail(parseResult.error),
			);
			return;
		}
		const target = parseResult.value;

		// 2. Determine new status from checkbox state
		// payload.checked = PRE-toggle state (what user saw before clicking)
		// User clicked to TOGGLE, so new state is the opposite
		const newStatus = payload.checked
			? TreeNodeStatus.NotStarted // Was checked → user wants to uncheck
			: TreeNodeStatus.Done; // Was unchecked → user wants to check

		// 3. Build ChangeNodeStatusAction based on target type
		const action = buildChangeStatusAction(target, newStatus, codecs);
		if (!action) {
			yield* Effect.logWarning(
				"[Librarian.handleCodexCheckboxClick] Failed to build action",
			);
			return;
		}

		// 4. Reconcile it in its turn
		yield* healing.queue.run(
			this.processQueueItem(healing, {
				kind: "Reconciliation",
				request: {
					source: "CodexClick",
					supplemental: { invalidCodexDeletions: [] },
					treeActions: [action],
				},
			}),
		);
	});
}

function buildChangeStatusAction(
	target: CodexClickTarget,
	newStatus: TreeNodeStatus,
	codecs: Codecs,
): ChangeNodeStatusAction | null {
	if (target.kind === "Section") {
		// Section click: propagate status to all descendants
		const { sectionChain } = target;
		if (sectionChain.length === 0) return null;

		const segmentId = sectionChain[sectionChain.length - 1];
		const parentChain = sectionChain.slice(0, -1);

		return {
			actionType: "ChangeStatus" as const,
			newStatus,
			targetLocator: {
				segmentId,
				segmentIdChainToParent: parentChain,
				targetKind: TreeNodeKind.Section,
			} as SectionNodeLocator,
		};
	}

	// Scroll click: update single scroll status
	const { parentChain, nodeName } = target;
	const segmentId = codecs.segmentId.serializeSegmentId({
		coreName: nodeName as NodeName,
		extension: MD,
		targetKind: TreeNodeKind.Scroll,
	});

	return {
		actionType: "ChangeStatus" as const,
		newStatus,
		targetLocator: {
			segmentId,
			segmentIdChainToParent: parentChain,
			targetKind: TreeNodeKind.Scroll,
		} as ScrollNodeLocator,
	};
}

/**
 * The scan failure that says the Library folder is not there, when it is
 * all that stopped the start: a defect or another failure beside it is a
 * Librarian that stopped.
 */
function missingLibraryRoot(
	cause: Cause.Cause<LibrarianStopFailure>,
): VamScanError | undefined {
	if (Cause.hasDies(cause)) return undefined;
	const failures = cause.reasons.filter(Cause.isFailReason);
	const [first] = failures;
	return failures.length === 1 && isMissingLibraryRoot(first?.error)
		? first.error
		: undefined;
}
