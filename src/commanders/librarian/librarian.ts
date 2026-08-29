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
	type CodexImpact,
	extractScrollStatusActions,
	findInvalidCodexFiles,
	getBacklinkHealingVaultActions,
	Healer,
	type HealingAction,
	isCodexInsideLibrary as isCodexInsideLibraryHelper,
	isCodexSplitPath,
	makeBulkInterpreter,
	makeCodecRulesFromSettings,
	makeCodecs,
	type NodeName,
	PREFIX_OF_CODEX,
	parseCodexClickLineContent,
	type SplitPathToMdFileInsideLibrary,
	scanAndGenerateOrphanActions,
	Tree,
	type TreeAction,
	TreeNodeKind,
	TreeNodeStatus,
} from "@textfresser/library-core";
import type { PayloadFor } from "@textfresser/obsidian-event-layer";
import type {
	BulkVaultEvent,
	VaultAction,
} from "@textfresser/vault-action-manager";
import {
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
} from "@textfresser/vault-action-manager";
import type {
	VaultActionManager,
	VaultActionManagerReadableMdPath,
	VaultActionManagerSubscription,
} from "@textfresser/vault-action-manager/facade";
import { Effect, Result } from "effect";
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
import {
	assembleVaultActions,
	buildInitialCreateActions,
	processCodexImpacts,
	processCodexImpactsForInit,
} from "./init";
import { listCommandsExecutableIn as listCommandsExecutableInImpl } from "./navigation/list-commands-executable";
import {
	getNextPage as getNextPageImpl,
	getPrevPage as getPrevPageImpl,
} from "./navigation/page-navigation";
import { resolveAliasFromSuffix } from "./navigation/wikilink-alias";
import type { SplitHealingInfo } from "./pages/split-to-pages-action";
import { HealingTransaction } from "./runtime/healing-transaction";
import { triggerSectionHealing as triggerSectionHealingImpl } from "./runtime/section-healing";
import { VaultActionQueue } from "./runtime/vault-action-queue";

// ─── Queue Item ───

type LibrarianQueueItem = {
	treeActions: TreeAction[];
	invalidCodexActions: HealingAction[];
};

type LibrarianDispatchFailure = Effect.Error<
	ReturnType<VaultActionManager["dispatch"]>
>;

// ─── Librarian ───

export class Librarian {
	private healer: Healer | null = null;
	private eventSubscription: VaultActionManagerSubscription | null = null;
	private actionQueue: VaultActionQueue<
		LibrarianQueueItem,
		LibrarianDispatchFailure
	> | null = null;
	private codecs!: Codecs;
	private interpretBulk!: BulkInterpreter;

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastTreeActions: TreeAction[] = [];
	public _debugLastHealingActions: HealingAction[] = [];
	public _debugLastVaultActions: VaultAction[] = [];

	constructor(private readonly vam: VaultActionManager) {}

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
					self.codecs = makeCodecs(
						makeCodecRulesFromSettings(settings),
					);
					self.interpretBulk = makeBulkInterpreter(self.codecs);
					const rootSplitPath = settings.splitPathToLibraryRoot;
					const libraryRoot = rootSplitPath.basename;

					// Create empty tree and healer
					self.healer = new Healer(
						new Tree(libraryRoot, self.codecs),
						self.codecs,
					);
					self.actionQueue = yield* VaultActionQueue.make<
						LibrarianQueueItem,
						LibrarianDispatchFailure
					>((item) =>
						self.processActions(
							item.treeActions,
							item.invalidCodexActions,
						),
					);

					// Read all files from library
					const allFilesResult = yield* self.vam
						.listAllFilesWithMdReaders(rootSplitPath)
						.pipe(Effect.result);

					if (Result.isFailure(allFilesResult)) {
						logger.error(
							"[Librarian] Failed to list files from vault:",
							allFilesResult.failure,
						);
						yield* self.subscribeToVaultEvents();
						return;
					}

					const allFiles = allFilesResult.success;

					// Build Create actions for each file
					const { createActions } = yield* buildInitialCreateActions(
						allFiles,
						self.codecs,
					);

					// Apply all create actions via HealingTransaction
					const tx = new HealingTransaction(self.healer);
					for (const action of createActions) {
						const result = tx.apply(action);
						if (result.isErr()) {
							tx.logSummary("error");
							logger.error(
								"[Librarian] Init transaction failed:",
								result.error,
							);
							yield* self.subscribeToVaultEvents();
							return;
						}
					}

					const allHealingActions: HealingAction[] =
						tx.getHealingActions();
					const allCodexImpacts: CodexImpact[] = tx.getCodexImpacts();

					// Delete invalid codex files (orphaned __ files)
					const invalidCodexActions = findInvalidCodexFiles(
						allFiles,
						self.healer,
						self.codecs,
					);
					allHealingActions.push(...invalidCodexActions);

					// Scan for orphaned codexes (wrong suffix, duplicates)
					const mdPaths = allFiles
						.filter(
							(f): f is VaultActionManagerReadableMdPath =>
								f.kind === SplitPathKind.MdFile,
						)
						.map(
							({ read, ...path }) =>
								path as SplitPathToMdFileInsideLibrary,
						);
					const { cleanupActions } = scanAndGenerateOrphanActions(
						self.healer,
						self.codecs,
						mdPaths,
					);
					allHealingActions.push(...cleanupActions);

					// Subscribe to vault events BEFORE dispatching actions
					// This ensures we catch all events, including cascading healing from init actions
					yield* self.subscribeToVaultEvents();

					// Process codex impacts: merge, compute deletions and recreations
					const { deletionHealingActions, codexRecreations } =
						processCodexImpactsForInit(
							allCodexImpacts,
							self.healer,
							self.codecs,
						);
					allHealingActions.push(...deletionHealingActions);

					// Combine all actions and dispatch once (healing → codex → backlink)
					const allVaultActions = [
						...assembleVaultActions(
							allHealingActions,
							codexRecreations,
							self.codecs,
						),
						...getBacklinkHealingVaultActions(
							self.healer,
							self.codecs,
						),
					];

					if (allVaultActions.length > 0) {
						yield* self.vam.dispatch(allVaultActions);
					}

					// Commit transaction after successful dispatch
					tx.commit();

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

			if (!this.healer) {
				logger.warn(
					"[Librarian.handleBulkEvent] No healer, returning early",
				);
				return;
			}

			const { treeActions, invalidCodexActions } =
				this.interpretBulk(bulk);

			// Store for debugging
			this._debugLastTreeActions = treeActions;

			if (treeActions.length === 0 && invalidCodexActions.length === 0) {
				return;
			}

			// Queue and process
			if (!this.actionQueue) return;
			yield* this.actionQueue.enqueue({
				invalidCodexActions,
				treeActions,
			});
		},
	);

	/**
	 * Process a batch of tree actions.
	 */
	private readonly processActions = Effect.fn("Librarian.processActions")(
		function* (
			this: Librarian,
			treeActions: TreeAction[],
			invalidCodexActions: HealingAction[],
		) {
			if (!this.healer) {
				return;
			}

			// Apply all tree actions via HealingTransaction
			const tx = new HealingTransaction(this.healer);
			for (const action of treeActions) {
				const result = tx.apply(action);
				if (result.isErr()) {
					tx.logSummary("error");
					logger.error(
						"[Librarian] Transaction failed:",
						result.error,
					);
					return;
				}
			}

			const allHealingActions: HealingAction[] = tx.getHealingActions();
			const allCodexImpacts: CodexImpact[] = tx.getCodexImpacts();

			// Add pre-extracted invalid codex deletions
			allHealingActions.push(...invalidCodexActions);

			// Process codex impacts: merge, compute deletions and recreations
			const { deletionHealingActions, codexRecreations } =
				processCodexImpacts(allCodexImpacts, this.healer, this.codecs);
			allHealingActions.push(...deletionHealingActions);

			// Extract scroll status changes from actions
			const scrollStatusActions = extractScrollStatusActions(
				treeActions,
				this.codecs,
			);

			// Combine all actions and dispatch once (healing → codex → backlink → scroll status)
			const allVaultActions = [
				...assembleVaultActions(
					allHealingActions,
					[...codexRecreations, ...scrollStatusActions],
					this.codecs,
				),
				...getBacklinkHealingVaultActions(this.healer, this.codecs),
			];

			// Store for debugging
			this._debugLastHealingActions = allHealingActions;
			this._debugLastVaultActions = allVaultActions;

			if (allVaultActions.length > 0) {
				yield* this.vam.dispatch(allVaultActions);
			}

			// Commit transaction after successful dispatch
			tx.commit();
		},
	);

	/**
	 * Cleanup: unsubscribe from vault events.
	 */
	readonly unsubscribe = Effect.fn("Librarian.unsubscribe")(function* (
		this: Librarian,
	) {
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
		return this.healer;
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
		if (!this.healer) {
			logger.warn(
				"[Librarian.triggerSectionHealing] No healer, returning early",
			);
			return;
		}

		yield* triggerSectionHealingImpl(
			{
				codecs: this.codecs,
				dispatch: (actions) => this.vam.dispatch(actions),
				healer: this.healer,
			},
			info,
		);
	});

	/**
	 * Get previous page by looking up siblings in tree.
	 * Returns null if current is first page or not a page file.
	 */
	getPrevPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		if (!this.healer) return null;
		return getPrevPageImpl(this.healer, this.codecs, currentFilePath);
	}

	/**
	 * Get next page by looking up siblings in tree.
	 * Returns null if current is last page or not a page file.
	 */
	getNextPage(currentFilePath: SplitPathToMdFile): SplitPathToMdFile | null {
		if (!this.healer) return null;
		return getNextPageImpl(this.healer, this.codecs, currentFilePath);
	}

	/**
	 * List all commands that could be executable for a given file path.
	 * Returns all possible commands for the file type; caller filters by selection state.
	 */
	listCommandsExecutableIn(splitPath: SplitPathToMdFile): CommandKind[] {
		return listCommandsExecutableInImpl(
			this.codecs,
			this.healer,
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
		if (!this.healer) return [];
		return this.healer.getLeavesByCoreName(coreName);
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
		if (!this.healer) {
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
			invalidCodexActions: [],
			treeActions: [action],
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
