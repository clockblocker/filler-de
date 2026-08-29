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
	VaultActionManagerSubscription,
	VaultScanResult,
} from "@textfresser/vault-action-manager";
import { MD, type SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	CommandContext,
	CommandKind,
} from "../../managers/obsidian/command-executor";
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
import type { SplitHealingInfo } from "./pages/split-to-pages-action";
import {
	classifyVamDispatchFailure,
	LibraryReconciler,
	ReconciliationAuditLog,
	type ReconciliationOutcome,
	type ReconciliationRecoveryInput,
	type ReconciliationRequest,
} from "./runtime/library-reconciliation";
import { triggerSectionHealing as triggerSectionHealingImpl } from "./runtime/section-healing";
import { VaultActionQueue } from "./runtime/vault-action-queue";

// ─── Queue Item ───

type LibrarianQueueItem = {
	request: ReconciliationRequest;
	observe?: (outcome: LibrarianReconciliationOutcome) => void;
};

export type LibrarianVam = Pick<
	VaultActionManager,
	| "cd"
	| "dispatch"
	| "getOpenedContent"
	| "mdPwd"
	| "scan"
	| "subscribeToBulk"
>;

type LibrarianDispatchFailure = Effect.Error<
	ReturnType<LibrarianVam["dispatch"]>
>;

type LibrarianRecoveryFailure =
	| Effect.Error<ReturnType<LibrarianVam["scan"]>>
	| {
			readonly diagnostics: VaultScanResult["diagnostics"];
			readonly kind: "PartialVaultScan";
	  };

type LibrarianReconciliationOutcome = ReconciliationOutcome<
	LibrarianDispatchFailure,
	LibrarianRecoveryFailure
>;

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
	private eventSubscription: VaultActionManagerSubscription | null = null;
	private actionQueue: VaultActionQueue<LibrarianQueueItem, never> | null =
		null;
	private startupBulkBuffer: BulkVaultEvent[] | null = null;
	private codecs!: Codecs;
	private interpretBulk!: BulkInterpreter;

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastScanDiagnostics: readonly VamScanError[] = [];

	get _debugLastReconciliationOutcome(): LibrarianReconciliationOutcome | null {
		return this.reconciliationAudit.getRecent(1)[0] ?? null;
	}

	constructor(private readonly vam: LibrarianVam) {}

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
			const rootSplitPath =
				getParsedUserSettings().splitPathToLibraryRoot;
			const scan = yield* this.vam.scan(rootSplitPath);
			return yield* this.prepareStartupReconciliation(
				scan,
				rootSplitPath.basename,
				false,
			);
		},
	);

	private makeReconciler(
		healer: Healer,
	): LibraryReconciler<LibrarianDispatchFailure, LibrarianRecoveryFailure> {
		return new LibraryReconciler(healer, this.codecs, {
			audit: this.reconciliationAudit,
			classifyDispatchFailure: classifyVamDispatchFailure,
			dispatch: (actions) => this.vam.dispatch(actions),
			recover: () => this.prepareRecovery(),
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
					self.startupBulkBuffer = [];
					self.reconciliationAudit = new ReconciliationAuditLog();
					self._debugLastScanDiagnostics = [];
					self.codecs = makeCodecs(
						makeCodecRulesFromSettings(settings),
					);
					self.interpretBulk = makeBulkInterpreter(self.codecs);
					const rootSplitPath = settings.splitPathToLibraryRoot;
					const libraryRoot = rootSplitPath.basename;

					const scan = yield* self.vam
						.scan(rootSplitPath)
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
					>((item) => self.processReconciliation(item));

					// Subscribe to vault events BEFORE dispatching actions
					// This ensures we catch all events, including cascading healing from init actions
					yield* self.subscribeToVaultEvents();

					const startupResult: {
						outcome?: LibrarianReconciliationOutcome;
					} = {};
					yield* self.actionQueue.enqueue({
						observe: (outcome) => {
							startupResult.outcome = outcome;
						},
						request: startup.request,
					});
					if (
						startupResult.outcome?.status === "Failed" ||
						startupResult.outcome?.status === "PartialFailure"
					) {
						return yield* Effect.fail(startupResult.outcome);
					}

					const bufferedBulks = self.startupBulkBuffer;
					self.startupBulkBuffer = null;
					for (const bulk of bufferedBulks) {
						yield* self.handleBulkEvent(bulk);
					}

					// Wait for queue to drain (events trigger handleBulkEvent which enqueues actions)
					// This ensures all cascading healing is queued and processed
					yield* self.actionQueue.waitForDrain();
				}),
			() => Effect.sync(decrementPending),
		).pipe(Effect.onError(() => self.unsubscribe().pipe(Effect.ignore)));
	});

	/**
	 * Subscribe to file system events from VaultActionManager.
	 */
	private readonly subscribeToVaultEvents = Effect.fn(
		"Librarian.subscribeToVaultEvents",
	)(function* (this: Librarian) {
		this.eventSubscription = yield* this.vam.subscribeToBulk((bulk) =>
			this.handleBulkEvent(bulk),
		);
	});

	/**
	 * Handle a bulk event: convert to tree actions, apply, dispatch healing.
	 */
	private readonly handleBulkEvent = Effect.fn("Librarian.handleBulkEvent")(
		function* (this: Librarian, bulk: BulkVaultEvent) {
			// Store for debugging
			this._debugLastBulkEvent = bulk;
			if (this.startupBulkBuffer !== null) {
				this.startupBulkBuffer.push(bulk);
				return;
			}

			if (!this.reconciler) {
				logger.warn(
					"[Librarian.handleBulkEvent] No healer, returning early",
				);
				return;
			}

			const { treeActions, invalidCodexActions } =
				this.interpretBulk(bulk);

			if (treeActions.length === 0 && invalidCodexActions.length === 0) {
				return;
			}

			// Queue and process
			if (!this.actionQueue) return;
			yield* this.actionQueue.enqueue({
				request: {
					source: "ObservedBulk",
					supplemental: {
						invalidCodexDeletions: invalidCodexActions,
					},
					treeActions,
				},
			});
		},
	);

	private readonly processReconciliation = Effect.fn(
		"Librarian.processReconciliation",
	)(function* (this: Librarian, item: LibrarianQueueItem) {
		if (!this.reconciler) return;
		const outcome = yield* this.reconciler.reconcile(item.request);
		item.observe?.(outcome);
		if (
			outcome.status === "Failed" ||
			outcome.status === "PartialFailure"
		) {
			logger.error("[Librarian] Reconciliation failed:", outcome);
		}
	});

	/**
	 * Cleanup: unsubscribe from vault events.
	 */
	readonly unsubscribe = Effect.fn("Librarian.unsubscribe")(function* (
		this: Librarian,
	) {
		this.startupBulkBuffer = null;
		const drain = this.actionQueue
			? this.actionQueue.waitForDrain()
			: Effect.void;
		if (this.eventSubscription) {
			const subscription = this.eventSubscription;
			this.eventSubscription = null;
			yield* subscription.close.pipe(Effect.ensuring(drain));
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

	/**
	 * Trigger section healing for a newly created section.
	 * Called by Bookkeeper to bypass self-event filtering.
	 *
	 * @param info - Contains section chain, deleted scroll, and page node names
	 */
	readonly triggerSectionHealing = Effect.fn(
		"Librarian.triggerSectionHealing",
	)(function* (this: Librarian, info: SplitHealingInfo) {
		const healer = this.getHealer();
		if (!healer) {
			logger.warn(
				"[Librarian.triggerSectionHealing] No healer, returning early",
			);
			return;
		}

		yield* triggerSectionHealingImpl(
			{
				codecs: this.codecs,
				dispatch: (actions) => this.vam.dispatch(actions),
				healer,
			},
			info,
		);
	});

	/**
	 * Get previous page by looking up siblings in tree.
	 * Returns null if current is first page or not a page file.
	 */
	getPrevPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		const healer = this.getHealer();
		if (!healer) return null;
		return getPrevPageImpl(healer, this.codecs, currentFilePath);
	}

	/**
	 * Get next page by looking up siblings in tree.
	 * Returns null if current is last page or not a page file.
	 */
	getNextPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		const healer = this.getHealer();
		if (!healer) return null;
		return getNextPageImpl(healer, this.codecs, currentFilePath);
	}

	/**
	 * List all commands that could be executable for a given file path.
	 * Returns all possible commands for the file type; caller filters by selection state.
	 */
	listCommandsExecutableIn(splitPath: SplitPathToMdFile): CommandKind[] {
		return listCommandsExecutableInImpl(
			this.codecs,
			this.getHealer(),
			splitPath,
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
		const parseResult = parseCodexClickLineContent(payload.lineContent);
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
