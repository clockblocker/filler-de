import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	CheckboxClickedEvent,
	ClickInterceptor,
} from "../../managers/obsidian/click-interceptor";
import type { PropertyCheckboxClickedEvent } from "../../managers/obsidian/click-interceptor/types/click-event";
import type {
	BulkVaultEvent,
	VaultAction,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import { SplitPathKind } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { decrementPending, incrementPending } from "../../utils/idle-tracker";
import { logger } from "../../utils/logger";
import {
	type CodecRules,
	type Codecs,
	type SplitPathToMdFileInsideLibrary,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "./codecs";
import type { ScrollNodeSegmentId } from "./codecs/segment-id/types/segment-id";
import { Healer } from "./healer/healer";
import { HealingTransaction } from "./healer/healing-transaction";
import type { CodexImpact } from "./healer/library-tree/codex";
import {
	extractInvalidCodexesFromBulk,
	parseCodexClickLineContent,
} from "./healer/library-tree/codex";
import { isCodexSplitPath } from "./healer/library-tree/codex/helpers";
import { Tree } from "./healer/library-tree/tree";
import { buildTreeActions } from "./healer/library-tree/tree-action/bulk-vault-action-adapter";
import { tryParseAsInsideLibrarySplitPath } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import { tryMakeTargetLocatorFromLibraryScopedSplitPath } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/split-path-to-locator";
import type { TreeAction } from "./healer/library-tree/tree-action/types/tree-action";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "./healer/library-tree/tree-node/types/atoms";
import type { HealingAction } from "./healer/library-tree/types/healing-action";
import { extractScrollStatusActions } from "./healer/library-tree/utils/extract-scroll-status-actions";
import { findInvalidCodexFiles } from "./healer/library-tree/utils/find-invalid-codex-files";
import {
	assembleVaultActions,
	buildInitialCreateActions,
	processCodexImpacts,
	processCodexImpactsForInit,
} from "./librarian-init";
import { scanAndGenerateOrphanActions } from "./healer/orphan-codex-scanner";

// ─── Queue ───

type QueueItem = {
	actions: TreeAction[];
	bulkEvent: BulkVaultEvent | null;
	resolve: () => void;
};

// ─── Librarian ───

export class Librarian {
	private healer: Healer | null = null;
	private eventTeardown: (() => void) | null = null;
	private clickTeardown: (() => void) | null = null;
	private queue: QueueItem[] = [];
	private processing = false;
	private codecs: Codecs;
	private rules: CodecRules;

	// Event-based queue drain
	private drainResolvers: Set<() => void> = new Set();

	// Track pending click operations for graceful unsubscribe
	private pendingClicks: Set<Promise<void>> = new Set();

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastTreeActions: TreeAction[] = [];
	public _debugLastHealingActions: HealingAction[] = [];
	public _debugLastVaultActions: VaultAction[] = [];

	constructor(
		private readonly vaultActionManager: VaultActionManager,
		private readonly clickInterceptor?: ClickInterceptor,
	) {}

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
					logger.error("[Librarian] Init transaction failed:", result.error);
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
				.filter((f): f is SplitPathToMdFileInsideLibrary & { read: () => Promise<string> } =>
					f.kind === SplitPathKind.MdFile)
				.map(({ read, ...path }) => path);
			const { cleanupActions, scanResult } = scanAndGenerateOrphanActions(
				this.healer,
				this.codecs,
				mdPaths,
			);
			if (scanResult.orphans.length > 0) {
				logger.info(`[Librarian] Found ${scanResult.orphans.length} orphaned codexes`);
			}
			allHealingActions.push(...cleanupActions);

			// Subscribe to vault events BEFORE dispatching actions
			// This ensures we catch all events, including cascading healing from init actions
			this.subscribeToVaultEvents();

			// Subscribe to click events
			this.subscribeToClickEvents();

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
			await this.waitForQueueToDrain();
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
	 * Subscribe to click events from ClickManager.
	 */
	private subscribeToClickEvents(): void {
		if (!this.clickInterceptor) return;

		this.clickTeardown = this.clickInterceptor.subscribe((event) => {
			if (event.kind === "CheckboxClicked") {
				this.handleCheckboxClick(event);
			} else if (event.kind === "PropertyCheckboxClicked") {
				this.handlePropertyCheckboxClick(event);
			}
		});
	}

	/**
	 * Handle checkbox click in a codex file.
	 */
	private handleCheckboxClick(event: CheckboxClickedEvent): void {
		// Check if file is a codex (basename starts with __)
		if (!isCodexSplitPath(event.splitPath)) {
			// Not a codex file, ignore
			return;
		}

		// Parse line content to get target
		const parseResult = parseCodexClickLineContent(event.lineContent);
		if (parseResult.isErr()) {
			return;
		}

		const target = parseResult.value;
		const newStatus = event.checked
			? TreeNodeStatus.Done
			: TreeNodeStatus.NotStarted;

		// Build ChangeStatus action
		let action: TreeAction;

		if (target.kind === "Scroll") {
			// Use serializeSegmentIdUnchecked for unsafe user input (validates and returns Result)
			const segmentIdResult =
				this.codecs.segmentId.serializeSegmentIdUnchecked({
					coreName: target.nodeName,
					extension: "md",
					targetKind: TreeNodeKind.Scroll,
				});
			if (segmentIdResult.isErr()) {
				logger.error(
					"[Librarian] Failed to serialize scroll segment ID:",
					segmentIdResult.error,
				);
				return;
			}
			action = {
				actionType: "ChangeStatus",
				newStatus,
				targetLocator: {
					segmentId: segmentIdResult.value as ScrollNodeSegmentId,
					segmentIdChainToParent: target.parentChain,
					targetKind: TreeNodeKind.Scroll,
				},
			};
		} else {
			// Section
			const sectionName =
				target.sectionChain[target.sectionChain.length - 1];
			if (!sectionName) return;

			action = {
				actionType: "ChangeStatus",
				newStatus,
				targetLocator: {
					segmentId: sectionName,
					segmentIdChainToParent: target.sectionChain.slice(0, -1),
					targetKind: TreeNodeKind.Section,
				},
			};
		}

		// Queue for processing and track pending operation
		const p = this.enqueue([action]);
		this.pendingClicks.add(p);
		p.finally(() => this.pendingClicks.delete(p));
	}

	/**
	 * Handle property checkbox click (frontmatter status toggle).
	 */
	private handlePropertyCheckboxClick(
		event: PropertyCheckboxClickedEvent,
	): void {
		logger.debug(
			"[Librarian] PropertyClick event:",
			JSON.stringify({
				propertyName: event.propertyName,
				checked: event.checked,
				path: event.splitPath.pathParts,
			}),
		);

		// Only handle "status" property
		if (event.propertyName !== "status") return;

		// Skip codex files
		if (isCodexSplitPath(event.splitPath)) return;

		// Try to parse as library-scoped path
		const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
			event.splitPath,
			this.rules,
		);
		if (libraryScopedResult.isErr()) return;

		// Get locator from split path
		const locatorResult = tryMakeTargetLocatorFromLibraryScopedSplitPath(
			libraryScopedResult.value,
			this.codecs,
		);
		if (locatorResult.isErr()) {
			logger.warn(
				"[Librarian] Failed to get locator for property click:",
				locatorResult.error,
			);
			return;
		}

		const locator = locatorResult.value;
		logger.debug(
			"[Librarian] Locator for property click:",
			JSON.stringify({
				segmentId: locator.segmentId,
				segmentIdChainToParent: locator.segmentIdChainToParent,
				targetKind: locator.targetKind,
			}),
		);

		// Only handle scroll nodes
		if (locator.targetKind !== TreeNodeKind.Scroll) return;

		const newStatus = event.checked
			? TreeNodeStatus.Done
			: TreeNodeStatus.NotStarted;

		const action: TreeAction = {
			actionType: "ChangeStatus",
			newStatus,
			targetLocator: {
				segmentId: locator.segmentId as ScrollNodeSegmentId,
				segmentIdChainToParent: locator.segmentIdChainToParent,
				targetKind: TreeNodeKind.Scroll,
			},
		};

		// Queue for processing
		const p = this.enqueue([action]);
		this.pendingClicks.add(p);
		p.finally(() => this.pendingClicks.delete(p));
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
		await this.enqueue(treeActions, bulk);
	}

	/**
	 * Enqueue tree actions for processing.
	 * Ensures serial processing of batches.
	 */
	private enqueue(
		actions: TreeAction[],
		bulkEvent: BulkVaultEvent | null = null,
	): Promise<void> {
		return new Promise((resolve) => {
			this.queue.push({ actions, bulkEvent, resolve });
			this.processQueue();
		});
	}

	/**
	 * Process queued actions one batch at a time.
	 */
	private async processQueue(): Promise<void> {
		if (this.processing) return;
		this.processing = true;
		incrementPending();

		try {
			while (this.queue.length > 0) {
				const item = this.queue.shift();
				if (!item) continue;

				try {
					await this.processActions(item.actions, item.bulkEvent);
				} catch (error) {
					logger.error(
						"[Librarian] Error processing actions:",
						error,
					);
				}

				item.resolve();
			}
		} finally {
			this.processing = false;
			decrementPending();
			this.signalQueueDrained();
		}
	}

	/**
	 * Wait for the queue to drain and all processing to complete.
	 * Uses event-based signaling instead of polling.
	 */
	private waitForQueueToDrain(): Promise<void> {
		if (this.queue.length === 0 && !this.processing) {
			return Promise.resolve();
		}
		return new Promise((resolve) => this.drainResolvers.add(resolve));
	}

	/**
	 * Signal all waiters that the queue has drained.
	 */
	private signalQueueDrained(): void {
		for (const resolve of this.drainResolvers) {
			resolve();
		}
		this.drainResolvers.clear();
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
	 * Cleanup: unsubscribe from vault and click events.
	 * Waits for any pending click operations to complete.
	 */
	async unsubscribe(): Promise<void> {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
		if (this.clickTeardown) {
			this.clickTeardown();
			this.clickTeardown = null;
		}
		// Wait for pending clicks to complete
		await Promise.all(this.pendingClicks);
	}

	/**
	 * Get current healer (for testing).
	 */
	getHealer(): Healer | null {
		return this.healer;
	}
}
