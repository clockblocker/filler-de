import { getParsedUserSettings } from "../../global-state/global-state";
import {
	createCheckboxFrontmatterHandler,
	createClipboardHandler,
	createSelectAllHandler,
	createWikilinkHandler,
} from "../../managers/actions-manager/behaviors";
import type { UserCommandKind } from "../../managers/actions-manager/types";
import type { UserEventInterceptor } from "../../managers/obsidian/user-event-interceptor";
import { PayloadKind } from "../../managers/obsidian/user-event-interceptor/types/payload-base";
import type {
	BulkVaultEvent,
	VaultAction,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
	type SplitPathToMdFileWithReader,
} from "../../managers/obsidian/vault-action-manager/types/split-path";
import { decrementPending, incrementPending } from "../../utils/idle-tracker";
import { logger } from "../../utils/logger";
import type { SplitHealingInfo } from "./bookkeeper/split-to-pages-action";
import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
	type SplitPathToMdFileInsideLibrary,
} from "./codecs";
import { Healer } from "./healer/healer";
import { HealingTransaction } from "./healer/healing-transaction";
import type { CodexImpact } from "./healer/library-tree/codex";
import { extractInvalidCodexesFromBulk } from "./healer/library-tree/codex";
import { Tree } from "./healer/library-tree/tree";
import { buildTreeActions } from "./healer/library-tree/tree-action/bulk-vault-action-adapter";
import type { TreeAction } from "./healer/library-tree/tree-action/types/tree-action";
import type { HealingAction } from "./healer/library-tree/types/healing-action";
import { extractScrollStatusActions } from "./healer/library-tree/utils/extract-scroll-status-actions";
import { findInvalidCodexFiles } from "./healer/library-tree/utils/find-invalid-codex-files";
import { scanAndGenerateOrphanActions } from "./healer/orphan-codex-scanner";
import {
	assembleVaultActions,
	buildInitialCreateActions,
	processCodexImpacts,
	processCodexImpactsForInit,
} from "./librarian-init";
import { listCommandsExecutableIn as listCommandsExecutableInImpl } from "./list-commands-executable";
import {
	getNextPage as getNextPageImpl,
	getPrevPage as getPrevPageImpl,
} from "./page-navigation";
import { triggerSectionHealing as triggerSectionHealingImpl } from "./section-healing";
import { VaultActionQueue } from "./vault-action-queue";

// ─── Queue Item ───

type LibrarianQueueItem = {
	actions: TreeAction[];
	bulkEvent: BulkVaultEvent | null;
};

// ─── Librarian ───

export class Librarian {
	private healer: Healer | null = null;
	private eventTeardown: (() => void) | null = null;
	private handlerTeardowns: (() => void)[] = [];
	private actionQueue: VaultActionQueue<LibrarianQueueItem>;
	private codecs: Codecs;
	private rules: CodecRules;

	// Track pending click operations for graceful unsubscribe
	private pendingClicks: Set<Promise<void>> = new Set();

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastTreeActions: TreeAction[] = [];
	public _debugLastHealingActions: HealingAction[] = [];
	public _debugLastVaultActions: VaultAction[] = [];

	constructor(
		private readonly vaultActionManager: VaultActionManager,
		private readonly userEventInterceptor?: UserEventInterceptor,
	) {
		this.actionQueue = new VaultActionQueue<LibrarianQueueItem>(
			(item) => this.processActions(item.actions, item.bulkEvent),
			"[Librarian]",
		);
	}

	/**
	 * Initialize librarian: read tree and heal mismatches.
	 */
	async init(): Promise<void> {
		incrementPending();
		try {
			const settings = getParsedUserSettings();
			this.rules = makeCodecRulesFromSettings(settings);
			this.codecs = makeCodecs(this.rules);
			const rootSplitPath = settings.splitPathToLibraryRoot;
			const libraryRoot = rootSplitPath.basename;

			// Create empty tree and healer
			this.healer = new Healer(
				new Tree(libraryRoot, this.codecs),
				this.codecs,
			);

			// Read all files from library
			const allFilesResult =
				await this.vaultActionManager.listAllFilesWithMdReaders(
					rootSplitPath,
				);

			if (allFilesResult.isErr()) {
				logger.error(
					"[Librarian] Failed to list files from vault:",
					allFilesResult.error,
				);
				this.subscribeToVaultEvents();
				return;
			}

			const allFiles = allFilesResult.value;

			// Build Create actions for each file
			const { createActions, migrationActions } =
				await buildInitialCreateActions(
					allFiles,
					this.codecs,
					this.rules,
				);

			// Apply all create actions via HealingTransaction
			const tx = new HealingTransaction(this.healer);
			for (const action of createActions) {
				const result = tx.apply(action);
				if (result.isErr()) {
					tx.logSummary("error");
					logger.error(
						"[Librarian] Init transaction failed:",
						result.error,
					);
					this.subscribeToVaultEvents();
					return;
				}
			}

			const allHealingActions: HealingAction[] = tx.getHealingActions();
			const allCodexImpacts: CodexImpact[] = tx.getCodexImpacts();

			// Delete invalid codex files (orphaned __ files)
			const invalidCodexActions = findInvalidCodexFiles(
				allFiles,
				this.healer,
				this.codecs,
				this.rules,
			);
			allHealingActions.push(...invalidCodexActions);

			// Scan for orphaned codexes (wrong suffix, duplicates)
			const mdPaths = allFiles
				.filter(
					(f): f is SplitPathToMdFileWithReader =>
						f.kind === SplitPathKind.MdFile,
				)
				.map(
					({ read, ...path }) =>
						path as SplitPathToMdFileInsideLibrary,
				);
			const { cleanupActions } = scanAndGenerateOrphanActions(
				this.healer,
				this.codecs,
				mdPaths,
			);
			allHealingActions.push(...cleanupActions);

			// Subscribe to vault events BEFORE dispatching actions
			// This ensures we catch all events, including cascading healing from init actions
			this.subscribeToVaultEvents();

			// Subscribe to user events (clicks, clipboard, select-all, wikilinks)
			this.registerUserEventHandlers();

			// Process codex impacts: merge, compute deletions and recreations
			const { deletionHealingActions, codexRecreations } =
				processCodexImpactsForInit(
					allCodexImpacts,
					this.healer,
					this.codecs,
				);
			allHealingActions.push(...deletionHealingActions);

			// Combine all actions and dispatch once
			const allVaultActions = [
				...assembleVaultActions(
					allHealingActions,
					codexRecreations,
					this.rules,
					this.codecs,
				),
				...migrationActions, // Convert YAML frontmatter to internal format
			];

			if (allVaultActions.length > 0) {
				await this.vaultActionManager.dispatch(allVaultActions);
			}

			// Commit transaction after successful dispatch
			tx.commit();
			tx.logSummary("debug");

			// Wait for queue to drain (events trigger handleBulkEvent which enqueues actions)
			// This ensures all cascading healing is queued and processed
			await this.actionQueue.waitForDrain();
		} finally {
			decrementPending();
		}
	}

	/**
	 * Subscribe to file system events from VaultActionManager.
	 */
	private subscribeToVaultEvents(): void {
		this.eventTeardown = this.vaultActionManager.subscribeToBulk(
			async (bulk: BulkVaultEvent) => {
				await this.handleBulkEvent(bulk);
			},
		);
	}

	/**
	 * Register handlers for user events (clicks, clipboard, select-all, wikilinks).
	 */
	private registerUserEventHandlers(): void {
		if (!this.userEventInterceptor) return;

		// Create enqueue function that tracks pending clicks
		const enqueue = async (action: TreeAction): Promise<void> => {
			const p = this.actionQueue.enqueue({
				actions: [action],
				bulkEvent: null,
			});
			this.pendingClicks.add(p);
			p.finally(() => this.pendingClicks.delete(p));
		};

		// Clipboard handler
		this.handlerTeardowns.push(
			this.userEventInterceptor.setHandler(
				PayloadKind.ClipboardCopy,
				createClipboardHandler(),
			),
		);

		// Select-all handler
		this.handlerTeardowns.push(
			this.userEventInterceptor.setHandler(
				PayloadKind.SelectAll,
				createSelectAllHandler(),
			),
		);

		// Checkbox frontmatter handler
		this.handlerTeardowns.push(
			this.userEventInterceptor.setHandler(
				PayloadKind.CheckboxInFrontmatterClicked,
				createCheckboxFrontmatterHandler(
					this.codecs,
					this.rules,
					enqueue,
				),
			),
		);

		// Wikilink handler
		this.handlerTeardowns.push(
			this.userEventInterceptor.setHandler(
				PayloadKind.WikilinkCompleted,
				createWikilinkHandler(this.codecs),
			),
		);
	}

	/**
	 * Handle a bulk event: convert to tree actions, apply, dispatch healing.
	 */
	private async handleBulkEvent(bulk: BulkVaultEvent): Promise<void> {
		// Store for debugging
		this._debugLastBulkEvent = bulk;

		if (!this.healer) {
			logger.warn(
				"[Librarian.handleBulkEvent] No healer, returning early",
			);
			return;
		}

		// Build tree actions from bulk event
		const treeActions = buildTreeActions(bulk, this.codecs, this.rules);

		// Store for debugging
		this._debugLastTreeActions = treeActions;

		if (treeActions.length === 0) {
			return;
		}

		// Queue and process
		await this.actionQueue.enqueue({
			actions: treeActions,
			bulkEvent: bulk,
		});
	}

	/**
	 * Process a batch of tree actions.
	 */
	private async processActions(
		actions: TreeAction[],
		bulkEvent: BulkVaultEvent | null,
	): Promise<void> {
		if (!this.healer) {
			return;
		}

		// Apply all tree actions via HealingTransaction
		const tx = new HealingTransaction(this.healer);
		for (const action of actions) {
			const result = tx.apply(action);
			if (result.isErr()) {
				tx.logSummary("error");
				logger.error("[Librarian] Transaction failed:", result.error);
				return;
			}
		}

		const allHealingActions: HealingAction[] = tx.getHealingActions();
		const allCodexImpacts: CodexImpact[] = tx.getCodexImpacts();

		// Extract invalid codexes from bulk event (after tree state updated)
		if (bulkEvent) {
			const invalidCodexDeletions = extractInvalidCodexesFromBulk(
				bulkEvent,
				this.codecs,
			);
			allHealingActions.push(...invalidCodexDeletions);
		}

		// Process codex impacts: merge, compute deletions and recreations
		const { deletionHealingActions, codexRecreations } =
			processCodexImpacts(allCodexImpacts, this.healer, this.codecs);
		allHealingActions.push(...deletionHealingActions);

		// Extract scroll status changes from actions
		const scrollStatusActions = extractScrollStatusActions(
			actions,
			this.codecs,
		);

		// Combine all actions and dispatch once
		const allVaultActions = assembleVaultActions(
			allHealingActions,
			[...codexRecreations, ...scrollStatusActions],
			this.rules,
			this.codecs,
		);

		// Store for debugging
		this._debugLastHealingActions = allHealingActions;
		this._debugLastVaultActions = allVaultActions;

		if (allVaultActions.length > 0) {
			await this.vaultActionManager.dispatch(allVaultActions);
		}

		// Commit transaction after successful dispatch
		tx.commit();
		tx.logSummary("debug");
	}

	/**
	 * Cleanup: unsubscribe from vault and user events.
	 * Waits for any pending click operations to complete.
	 */
	async unsubscribe(): Promise<void> {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
		// Unregister all user event handlers
		for (const teardown of this.handlerTeardowns) {
			teardown();
		}
		this.handlerTeardowns = [];
		// Wait for pending clicks to complete
		await Promise.all(this.pendingClicks);
	}

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
	async triggerSectionHealing(info: SplitHealingInfo): Promise<void> {
		if (!this.healer) {
			logger.warn(
				"[Librarian.triggerSectionHealing] No healer, returning early",
			);
			return;
		}

		await triggerSectionHealingImpl(
			{
				codecs: this.codecs,
				dispatch: async (actions) => {
					await this.vaultActionManager.dispatch(actions);
				},
				healer: this.healer,
				rules: this.rules,
			},
			info,
		);
	}

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
	listCommandsExecutableIn(splitPath: SplitPathToMdFile): UserCommandKind[] {
		return listCommandsExecutableInImpl(this.codecs, splitPath);
	}
}
