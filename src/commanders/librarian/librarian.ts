import type {
	LeafMatch,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "@textfresser/library-core";
import {
	type BulkInterpreter,
	type ChangeNodeStatusAction,
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
import { Cause, Effect, Result, Schema } from "effect";
import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	CommandContext,
	CommandKind,
} from "../../managers/obsidian/command-executor";
import { getErrorMessage } from "../../utils/get-error-message";
import { decrementPending, incrementPending } from "../../utils/idle-tracker";
import { logger } from "../../utils/logger";
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
	classifyVamDispatchFailure,
	LibraryReconciler,
	ReconciliationAuditLog,
	type ReconciliationOutcome,
	type ReconciliationRecoveryInput,
	type ReconciliationRequest,
} from "./runtime/library-reconciliation";
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
	readonly observe?: (outcome: LibrarianReconciliationOutcome) => void;
};

type CommandIntentionQueueItem = {
	readonly intention: LibraryCommandIntention;
	readonly kind: "CommandIntention";
	readonly observe: (result: LibraryCommandIntentionResult) => void;
};

/** A bulk VAM delivered, interpreted only when its turn comes. */
type ObservedBulkQueueItem = {
	readonly bulk: BulkVaultEvent;
	readonly kind: "ObservedBulk";
};

type LibrarianQueueItem =
	| ReconciliationQueueItem
	| CommandIntentionQueueItem
	| ObservedBulkQueueItem;

export type LibrarianVam = Pick<
	VaultActionManager,
	| "cd"
	| "dispatch"
	| "getActiveEditorContext"
	| "getOpenedContent"
	| "mdPwd"
	| "scanAndSubscribe"
>;

class LibrarianUnexpectedDispatchError extends Schema.TaggedError<LibrarianUnexpectedDispatchError>()(
	"LibrarianUnexpectedDispatchError",
	{
		cause: Schema.Defect(),
		operation: Schema.Literal("dispatch"),
	},
) {
	override get message(): string {
		return `${this.operation}: ${getErrorMessage(this.cause)}`;
	}
}

class LibrarianUnexpectedRecoveryError extends Schema.TaggedError<LibrarianUnexpectedRecoveryError>()(
	"LibrarianUnexpectedRecoveryError",
	{
		cause: Schema.Defect(),
		operation: Schema.Literal("scan"),
	},
) {}

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

export class LibraryCommandIntentionError extends Schema.TaggedError<LibraryCommandIntentionError>()(
	"LibraryCommandIntentionError",
	{ kind: Schema.Literal("LibrarianUnavailable") },
) {}

/**
 * Why the Librarian stopped, with a message for the user. `LibraryRootMissing`
 * is a vault without its Library folder, not a failure to heal.
 */
export type LibrarianStop = {
	readonly kind: "Stopped" | "LibraryRootMissing";
	readonly message: string;
};

export type LibrarianOptions = {
	/**
	 * Told when the Librarian stops: its startup failed, or a later
	 * reconciliation failed past recovery.
	 */
	readonly onStopped?: (stop: LibrarianStop) => void;
};

// ─── Librarian ───

export class Librarian {
	private reconciler: LibraryReconciler<
		LibrarianDispatchFailure,
		LibrarianRecoveryFailure
	> | null = null;
	private reconciliationAudit = new ReconciliationAuditLog<
		LibrarianDispatchFailure,
		LibrarianRecoveryFailure
	>();
	/**
	 * The Library's snapshot and the vault changes after it. Kept after
	 * `unsubscribe` closes it, so a reconciliation still running can rescan.
	 */
	private subscription: VaultSnapshotSubscription | null = null;
	private actionQueue: VaultActionQueue<LibrarianQueueItem, never> | null =
		null;
	/** Until startup reconciliation ends; VAM holds vault changes meanwhile. */
	private starting = false;
	private nextCommandOperationId = 0;
	private codecs!: Codecs;
	private interpretBulk!: BulkInterpreter;

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastScanDiagnostics: readonly VamScanError[] = [];

	get _debugLastReconciliationOutcome(): LibrarianReconciliationOutcome | null {
		return this.reconciliationAudit.getRecent(1)[0] ?? null;
	}

	constructor(
		private readonly vam: LibrarianVam,
		private readonly options: LibrarianOptions = {},
	) {}

	private reportStopped(phase: LibrarianStopPhase, failure: unknown): void {
		if (phase === "Startup" && isMissingLibraryRoot(failure)) {
			const message = describeMissingLibraryRoot(failure);
			logger.warn(`[Librarian] ${message}`, failure);
			this.options.onStopped?.({ kind: "LibraryRootMissing", message });
			return;
		}
		const message = describeLibrarianStop(phase, failure);
		logger.error(`[Librarian] Stopped. ${message}`, failure);
		this.options.onStopped?.({ kind: "Stopped", message });
	}

	private prepareStartupReconciliation(
		scan: VaultScanResult,
		libraryRoot: NodeName,
		allowPartial: boolean,
	): Effect.Effect<ReconciliationRecoveryInput, LibrarianRecoveryFailure> {
		if (!allowPartial && scan.kind === "Partial") {
			return Effect.fail({
				diagnostics: scan.diagnostics,
				kind: "PartialVaultScan",
			});
		}

		return buildInitialCreateActions(scan.entries, this.codecs).pipe(
			Effect.tap(({ createDiagnostics }) =>
				Effect.sync(() => {
					for (const diagnostic of createDiagnostics) {
						logger.warn(
							"[Librarian] Invalid startup Create observation:",
							diagnostic,
						);
					}
				}),
			),
			Effect.map(({ createActions }) => ({
				healer: new Healer(
					new Tree(libraryRoot, this.codecs),
					this.codecs,
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
			const subscription = this.subscription;
			if (!subscription) {
				return yield* new LibrarianUnexpectedRecoveryError({
					cause: new Error("The Librarian has no Library snapshot"),
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
				this.codecs.rules.libraryRootName,
				this.starting,
			);
		},
	);

	private makeReconciler(
		healer: Healer,
	): LibraryReconciler<LibrarianDispatchFailure, LibrarianRecoveryFailure> {
		return new LibraryReconciler(healer, this.codecs, {
			audit: this.reconciliationAudit,
			classifyDispatchFailure: classifyLibrarianDispatchFailure,
			dispatch: (actions) =>
				this.vam.dispatch(actions, { caller: "librarian" }),
			recover: () => this.prepareRecovery(),
			unexpectedDispatchFailure: (cause) =>
				new LibrarianUnexpectedDispatchError({
					cause: Cause.squash(cause),
					operation: "dispatch",
				}),
			unexpectedRecoveryFailure: (cause) =>
				new LibrarianUnexpectedRecoveryError({
					cause: Cause.squash(cause),
					operation: "scan",
				}),
		});
	}

	/**
	 * Initialize librarian: read tree and heal mismatches.
	 */
	readonly init = Effect.fn("Librarian.init")(function* (this: Librarian) {
		const self = this;
		return yield* Effect.acquireUseRelease(
			Effect.sync(incrementPending),
			() =>
				Effect.gen(function* () {
					const settings = getParsedUserSettings();
					self.reconciler = null;
					self.actionQueue = null;
					self.subscription = null;
					self.starting = true;
					self.reconciliationAudit = new ReconciliationAuditLog();
					self._debugLastScanDiagnostics = [];
					self.codecs = makeCodecs(
						makeCodecRulesFromSettings(settings),
					);
					self.interpretBulk = makeBulkInterpreter(self.codecs);
					const rootSplitPath = settings.splitPathToLibraryRoot;
					const libraryRoot = rootSplitPath.basename;

					// The snapshot and the subscription share one cursor: every
					// vault change after the snapshot reaches handleBulkEvent
					// once, and none it holds does. VAM holds them until
					// `start`, below.
					// External events only: the Librarian's own renames, and
					// every other caller's, are never healed again.
					const subscription = yield* self.vam
						.scanAndSubscribe(
							rootSplitPath,
							{ onBulk: (bulk) => self.handleBulkEvent(bulk) },
							{ from: "external" },
						)
						.pipe(
							Effect.tapError((failure) =>
								Effect.sync(() =>
									logger.error(
										"[Librarian] Vault scan failed:",
										failure,
									),
								),
							),
						);
					self.subscription = subscription;
					const scan = subscription.snapshot;
					self._debugLastScanDiagnostics = scan.diagnostics;
					if (scan.kind === "Partial") {
						for (const diagnostic of scan.diagnostics) {
							logger.warn(
								`[Librarian] Partial vault scan at ${diagnostic.path}:`,
								diagnostic,
							);
						}
					}

					const startup = yield* self.prepareStartupReconciliation(
						scan,
						libraryRoot,
						true,
					);
					self.reconciler = self.makeReconciler(startup.healer);
					self.actionQueue = yield* VaultActionQueue.make<
						LibrarianQueueItem,
						never
					>((item) => self.processQueueItem(item));

					const startupResult: {
						outcome?: LibrarianReconciliationOutcome;
					} = {};
					yield* self.actionQueue.enqueue({
						kind: "Reconciliation",
						observe: (outcome) => {
							startupResult.outcome = outcome;
						},
						request: startup.request,
					});
					const startupOutcome = startupResult.outcome;
					if (
						startupOutcome?.status === "Failed" ||
						startupOutcome?.status === "PartialFailure"
					) {
						if (startupOutcome.recovery.kind !== "Resynchronized") {
							return yield* Effect.fail(startupOutcome);
						}
						logger.warn(
							"[Librarian] Startup healing partly failed; a rescan of the library recovered it:",
							startupOutcome,
						);
					}

					self.starting = false;
					// The changes after the latest snapshot, the first or a
					// recovery's rescan, now reach handleBulkEvent.
					yield* subscription.start;
				}),
			() => Effect.sync(decrementPending),
		).pipe(
			Effect.tapCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.void
					: Effect.sync(() =>
							self.reportStopped("Startup", Cause.squash(cause)),
						),
			),
			Effect.onError(() => self.unsubscribe().pipe(Effect.ignore)),
		);
	});

	/**
	 * Handle a bulk event: queue it, to be turned into tree actions and
	 * healed in its turn.
	 */
	private readonly handleBulkEvent = Effect.fn("Librarian.handleBulkEvent")(
		function* (this: Librarian, bulk: BulkVaultEvent) {
			// Store for debugging
			this._debugLastBulkEvent = bulk;
			if (!this.reconciler || !this.actionQueue) {
				logger.warn(
					"[Librarian.handleBulkEvent] No healer, returning early",
				);
				return;
			}
			yield* this.actionQueue.enqueue({ bulk, kind: "ObservedBulk" });
		},
	);

	/**
	 * The reconciliation a queued bulk asks for, or null when it asks for
	 * none. Interpreted in its turn, so a rescan that ran while it waited,
	 * and holds part of it, leaves only the rest.
	 */
	private observedBulkRequest(
		bulk: BulkVaultEvent,
	): ReconciliationRequest | null {
		const current = this.subscription
			? this.subscription.afterSnapshot(bulk)
			: bulk;
		if (!current) return null;
		const { createDiagnostics, treeActions, invalidCodexActions } =
			this.interpretBulk(current);
		for (const diagnostic of createDiagnostics) {
			logger.warn(
				"[Librarian] Invalid live Create observation:",
				diagnostic,
			);
		}
		if (treeActions.length === 0 && invalidCodexActions.length === 0) {
			return null;
		}
		return {
			source: "ObservedBulk",
			supplemental: { invalidCodexDeletions: invalidCodexActions },
			treeActions,
		};
	}

	private readonly processQueueItem = Effect.fn("Librarian.processQueueItem")(
		function* (this: Librarian, queued: LibrarianQueueItem) {
			if (!this.reconciler) return;
			if (queued.kind === "CommandIntention") {
				yield* this.processCommandIntention(queued).pipe(
					Effect.uninterruptible,
				);
				return;
			}
			let item: ReconciliationQueueItem;
			if (queued.kind === "ObservedBulk") {
				const request = this.observedBulkRequest(queued.bulk);
				if (!request) return;
				item = { kind: "Reconciliation", request };
			} else {
				item = queued;
			}

			const wasUnavailable = this.reconciler.isUnavailable();
			const outcome = yield* this.reconciler.reconcile(item.request);
			item.observe?.(outcome);
			if (
				outcome.status === "Failed" ||
				outcome.status === "PartialFailure"
			) {
				logger.error("[Librarian] Reconciliation failed:", outcome);
			}
			// A failed startup is reported once, by init.
			if (item.request.source !== "Startup") {
				this.reportIfNewlyStopped(wasUnavailable, outcome);
			}
		},
	);

	private reportIfNewlyStopped(
		wasUnavailable: boolean,
		outcome: LibrarianReconciliationOutcome,
	): void {
		if (!wasUnavailable && this.reconciler?.isUnavailable()) {
			this.reportStopped("Runtime", outcome);
		}
	}

	private readonly processCommandIntention = Effect.fn(
		"Librarian.processCommandIntention",
	)(function* (this: Librarian, item: CommandIntentionQueueItem) {
		if (!this.reconciler) return;
		const { intention } = item;
		const wasUnavailable = this.reconciler.isUnavailable();
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
								cause: Cause.squash(cause),
								operation: "dispatch",
							}),
						),
					),
				),
			);
		if (Result.isFailure(dispatchResult)) {
			const outcome =
				yield* this.reconciler.reconcileExternalDispatchFailure({
					failure: dispatchResult.failure,
					operationId: intention.operationId,
					source: "CommandIntention",
					submittedCount: intention.vaultActions.length,
				});
			item.observe({
				failure: dispatchResult.failure,
				kind: "VaultDispatchFailed",
				operationId: intention.operationId,
				outcome,
			});
			logger.error(
				"[Librarian] Command intention vault dispatch failed:",
				outcome,
			);
			this.reportIfNewlyStopped(wasUnavailable, outcome);
			return;
		}

		const outcome = yield* this.reconciler.reconcile({
			operationId: intention.operationId,
			source: "CommandIntention",
			supplemental: { invalidCodexDeletions: [] },
			treeActions: intention.treeActions,
		});
		if (
			outcome.status === "Failed" ||
			outcome.status === "PartialFailure"
		) {
			item.observe({
				initialDispatch: {
					kind: "Completed",
					submittedCount: intention.vaultActions.length,
				},
				kind: "ReconciliationFailed",
				operationId: intention.operationId,
				outcome,
			});
			logger.error(
				"[Librarian] Command intention reconciliation failed:",
				outcome,
			);
			this.reportIfNewlyStopped(wasUnavailable, outcome);
			return;
		}
		item.observe({
			initialDispatch: {
				kind: "Completed",
				submittedCount: intention.vaultActions.length,
			},
			kind: "Completed",
			operationId: intention.operationId,
			outcome,
		});
	});

	/**
	 * Cleanup: unsubscribe from vault events.
	 */
	readonly unsubscribe = Effect.fn("Librarian.unsubscribe")(function* (
		this: Librarian,
	) {
		this.starting = false;
		const drain = this.actionQueue
			? this.actionQueue.waitForDrain()
			: Effect.void;
		if (this.subscription) {
			// Closing twice is a no-op; the subscription stays for rescans.
			yield* this.subscription.close.pipe(Effect.ensuring(drain));
			return;
		}
		yield* drain;
	});

	/**
	 * Get current healer (for testing).
	 */
	getHealer(): Healer | null {
		return this.reconciler?.getCommittedHealer() ?? null;
	}

	getRecentReconciliationOutcomes(
		count = 10,
	): readonly LibrarianReconciliationOutcome[] {
		return this.reconciliationAudit.getRecent(count);
	}

	/** Execute a validated page-split batch and its Tree intention under one permit. */
	readonly executeSplitIntention = Effect.fn(
		"Librarian.executeSplitIntention",
	)(function* (
		this: Librarian,
		plan: PageSplitPlan,
	): Effect.fn.Return<
		LibraryCommandIntentionResult,
		LibraryCommandIntentionError
	> {
		if (!this.reconciler || !this.actionQueue) {
			return yield* Effect.fail(
				new LibraryCommandIntentionError({
					kind: "LibrarianUnavailable",
				}),
			);
		}

		const observed: { result?: LibraryCommandIntentionResult } = {};
		this.nextCommandOperationId += 1;
		const intention: LibraryCommandIntention = {
			operationId: `split-${this.nextCommandOperationId}`,
			treeActions: plan.treeActions,
			vaultActions: plan.vaultActions,
		};
		yield* this.actionQueue.enqueue({
			intention,
			kind: "CommandIntention",
			observe: (result) => {
				observed.result = result;
			},
		});
		if (!observed.result) {
			return yield* Effect.fail(
				new LibraryCommandIntentionError({
					kind: "LibrarianUnavailable",
				}),
			);
		}
		return observed.result;
	});

	/**
	 * Get previous page by looking up siblings in tree.
	 * Returns null if current is first page or not a page file.
	 */
	getPrevPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		const healer = this.getHealer();
		if (!healer) return null;
		const libraryScope = makeLibraryScope(this.codecs.rules);
		const libraryPath = libraryScope.toLibraryPath(currentFilePath);
		if (libraryPath.isErr()) return null;
		const previous = getPrevPageImpl(
			healer,
			this.codecs,
			libraryPath.value,
		);
		return previous ? libraryScope.toVaultPath(previous) : null;
	}

	/**
	 * Get next page by looking up siblings in tree.
	 * Returns null if current is last page or not a page file.
	 */
	getNextPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		const healer = this.getHealer();
		if (!healer) return null;
		const libraryScope = makeLibraryScope(this.codecs.rules);
		const libraryPath = libraryScope.toLibraryPath(currentFilePath);
		if (libraryPath.isErr()) return null;
		const next = getNextPageImpl(healer, this.codecs, libraryPath.value);
		return next ? libraryScope.toVaultPath(next) : null;
	}

	/**
	 * List all commands that could be executable for a given file path.
	 * Returns all possible commands for the file type; caller filters by selection state.
	 */
	listCommandsExecutableIn(splitPath: SplitPathToMdFile): CommandKind[] {
		const libraryPath = makeLibraryScope(this.codecs.rules).toLibraryPath(
			splitPath,
		);
		if (libraryPath.isErr()) return [];
		return listCommandsExecutableInImpl(
			this.codecs,
			this.getHealer(),
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
				Effect.sync(() => {
					logger.warn(`[Librarian.${commandName}] Failed:`, error);
				}),
			),
		);
	}

	isCodexInsideLibrary(splitPath: SplitPathToMdFile): boolean {
		return isCodexInsideLibraryHelper(splitPath, this.codecs.rules);
	}

	/**
	 * Whether a vault path is the Library root folder or lies under it.
	 * False until init has read the configured root.
	 */
	isInsideLibrary(splitPath: AnySplitPath): boolean {
		if (!this.codecs) return false;
		return this.codecs.splitPathInsideLibrary.checkIfInsideLibrary(
			splitPath,
		);
	}

	/** Whether a path names a codex file (basename carries the codex prefix). */
	isCodex(splitPath: AnySplitPath): boolean {
		return isCodexSplitPath(splitPath);
	}

	resolveWikilinkAlias(linkContent: string): string | null {
		const result = resolveAliasFromSuffix(
			linkContent,
			this.codecs.suffix,
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
		const parsed = this.codecs.suffix.parseSeparatedSuffix(basename);
		if (parsed.isErr()) {
			return null;
		}
		return {
			coreName: parsed.value.coreName,
			suffixParts: [...parsed.value.suffixParts],
		};
	}

	/**
	 * Handle checkbox click in a codex file.
	 * Parses the line content to determine the target (scroll or section),
	 * builds a ChangeNodeStatusAction, and enqueues it for processing.
	 */
	readonly handleCodexCheckboxClick = Effect.fn(
		"Librarian.handleCodexCheckboxClick",
	)(function* (this: Librarian, payload: PayloadFor<"CheckboxClicked">) {
		if (!this.reconciler) {
			logger.warn("[Librarian.handleCodexCheckboxClick] No healer");
			return;
		}

		// 1. Parse line content to get click target
		const parseResult = parseCodexClickLineContent(
			payload.lineContent,
			this.codecs,
		);
		if (parseResult.isErr()) {
			logger.warn(
				"[Librarian.handleCodexCheckboxClick] Parse failed:",
				parseResult.error,
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
		const action = this.buildChangeStatusAction(target, newStatus);
		if (!action) {
			logger.warn(
				"[Librarian.handleCodexCheckboxClick] Failed to build action",
			);
			return;
		}

		// 4. Enqueue for processing
		if (!this.actionQueue) return;
		yield* this.actionQueue.enqueue({
			kind: "Reconciliation",
			request: {
				source: "CodexClick",
				supplemental: { invalidCodexDeletions: [] },
				treeActions: [action],
			},
		});
	});

	private buildChangeStatusAction(
		target: CodexClickTarget,
		newStatus: TreeNodeStatus,
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
		const segmentId = this.codecs.segmentId.serializeSegmentId({
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
}
