import { z } from "zod";
import { getParsedUserSettings } from "../../global-state/global-state";

// Debug logging using console (visible in Obsidian dev tools)
function debugLog(msg: string): void {
	const timestamp = new Date().toISOString();
	console.log(`[LIBRARIAN-DEBUG ${timestamp}] ${msg}`);
}

import type {
	CheckboxClickedEvent,
	ClickManager,
} from "../../managers/obsidian/click-manager";
import type {
	BulkVaultEvent,
	VaultActionManager,
	VaultAction,
} from "../../managers/obsidian/vault-action-manager";
import type { SplitPathWithReader } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { readMetadata } from "../../managers/pure/note-metadata-manager";
import { decrementPending, incrementPending } from "../../utils/idle-tracker";
import { logger } from "../../utils/logger";
import {
	type AnySplitPathInsideLibrary,
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "./codecs";
import { healingActionsToVaultActions } from "./codecs/healing-to-vault-action";
import type { ScrollNodeSegmentId } from "./codecs/segment-id/types/segment-id";
import { Healer } from "./healer/healer";
import {
	type CodexImpact,
	codexActionsToVaultActions,
	codexImpactToDeletions,
	codexImpactToRecreations,
	extractInvalidCodexesFromBulk,
	parseCodexClickLineContent,
} from "./healer/library-tree/codex";
import { isCodexSplitPath } from "./healer/library-tree/codex/helpers";
import { mergeCodexImpacts } from "./healer/library-tree/codex/merge-codex-impacts";
import { Tree } from "./healer/library-tree/tree";
import { buildTreeActions } from "./healer/library-tree/tree-action/bulk-vault-action-adapter";
import { tryParseAsInsideLibrarySplitPath } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import { inferCreatePolicy } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/infer-create";
import type {
	CreateTreeLeafAction,
	TreeAction,
} from "./healer/library-tree/tree-action/types/tree-action";
import { tryCanonicalizeSplitPathToDestination } from "./healer/library-tree/tree-action/utils/canonical-naming/canonicalize-to-destination";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "./healer/library-tree/tree-node/types/atoms";
import type { HealingAction } from "./healer/library-tree/types/healing-action";
import { extractScrollStatusActions } from "./healer/library-tree/utils/extract-scroll-status-actions";
import { findInvalidCodexFiles } from "./healer/library-tree/utils/find-invalid-codex-files";

// ─── Scroll Metadata Schema ───

const ScrollMetadataSchema = z.object({
	status: z.enum(["Done", "NotStarted"]),
});

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

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastTreeActions: TreeAction[] = [];
	public _debugLastHealingActions: HealingAction[] = [];
	public _debugLastVaultActions: VaultAction[] = [];

	constructor(
		private readonly vaultActionManager: VaultActionManager,
		private readonly clickManager?: ClickManager,
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

			// Log initial read
			logger.info("[Librarian] Initial read - allFiles:", {
				count: allFiles.length,
				files: allFiles.map((f) => ({
					basename: f.basename,
					extension: "extension" in f ? f.extension : undefined,
					hasRead: "read" in f,
					kind: f.kind,
					pathParts: f.pathParts,
				})),
			});

			// Build Create actions for each file
			const createActions =
				await this.buildInitialCreateActions(allFiles);

			// Log create actions
			logger.info("[Librarian] Initial read - createActions:", {
				actions: createActions.map((a) => ({
					actionType: a.actionType,
					observedSplitPath: a.observedSplitPath
						? {
								basename: a.observedSplitPath.basename,
								extension: a.observedSplitPath.extension,
								kind: a.observedSplitPath.kind,
								pathParts: a.observedSplitPath.pathParts,
							}
						: undefined,
					targetLocator: {
						segmentId: a.targetLocator.segmentId,
						segmentIdChainToParent:
							a.targetLocator.segmentIdChainToParent,
						targetKind: a.targetLocator.targetKind,
					},
				})),
				count: createActions.length,
			});

			// Apply all create actions and collect healing + codex impacts
			const allHealingActions: HealingAction[] = [];
			const allCodexImpacts: CodexImpact[] = [];

			for (const action of createActions) {
				const result = this.healer.getHealingActionsFor(action);
				allHealingActions.push(...result.healingActions);
				allCodexImpacts.push(result.codexImpact);
			}

			// Delete invalid codex files (orphaned __ files)
			const invalidCodexActions = findInvalidCodexFiles(
				allFiles,
				this.healer,
				this.codecs,
				this.rules,
			);
			allHealingActions.push(...invalidCodexActions);

			// Subscribe to vault events BEFORE dispatching actions
			// This ensures we catch all events, including cascading healing from init actions
			this.subscribeToVaultEvents();

			// Subscribe to click events
			this.subscribeToClickEvents();

			// Convert codex deletions to healing actions
			const mergedImpact = mergeCodexImpacts(allCodexImpacts);
			const codexDeletions = codexImpactToDeletions(
				mergedImpact,
				this.healer,
				this.codecs,
			);
			allHealingActions.push(...codexDeletions);

			// Generate codex recreations
			const codexRecreations = codexImpactToRecreations(
				mergedImpact,
				this.healer,
				this.codecs,
			);

			// Combine all actions and dispatch once
			const allVaultActions = [
				...healingActionsToVaultActions(allHealingActions, this.rules),
				...codexActionsToVaultActions(
					codexRecreations,
					this.rules,
					this.codecs,
				),
			];

			if (allVaultActions.length > 0) {
				await this.vaultActionManager.dispatch(allVaultActions);
			}

			// Wait for queue to drain (events trigger handleBulkEvent which enqueues actions)
			// This ensures all cascading healing is queued and processed
			await this.waitForQueueToDrain();
		} finally {
			decrementPending();
		}
	}

	/**
	 * Build CreateTreeLeafAction for each file in the library.
	 * Applies policy (NameKing for root, PathKing for nested) to determine canonical location.
	 * Reads status from md file metadata.
	 */
	private async buildInitialCreateActions(
		files: SplitPathWithReader[],
	): Promise<CreateTreeLeafAction[]> {
		const actions: CreateTreeLeafAction[] = [];

		for (const file of files) {
			// Skip codex files (basename starts with __)
			if (isCodexSplitPath(file, this.codecs)) {
				continue;
			}

			// Convert to library-scoped path
			const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
				file,
				this.rules,
			);
			if (libraryScopedResult.isErr()) continue;
			const observedPath = libraryScopedResult.value;

			// Apply policy to get canonical destination
			// NameKing for root-level files, PathKing for nested
			const policy = inferCreatePolicy(observedPath);
			const canonicalResult = tryCanonicalizeSplitPathToDestination(
				observedPath,
				policy,
				undefined, // no rename intent for create
				this.codecs,
			);
			if (canonicalResult.isErr()) {
				continue;
			}
			const canonicalPath = canonicalResult.value;

			// Build locator from canonical path
			const locatorResult =
				this.codecs.locator.canonicalSplitPathInsideLibraryToLocator(
					canonicalPath,
				);
			if (locatorResult.isErr()) continue;
			const locator = locatorResult.value;

			// Read status for md files
			let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
			if (file.kind === SplitPathKind.MdFile && "read" in file) {
				const contentResult = await file.read();
				if (contentResult.isOk()) {
					const meta = readMetadata(
						contentResult.value,
						ScrollMetadataSchema,
					);
					if (meta?.status === "Done") {
						status = TreeNodeStatus.Done;
					}
				}
			}

			if (locator.targetKind === TreeNodeKind.Scroll) {
				actions.push({
					actionType: "Create",
					initialStatus: status,
					observedSplitPath:
						observedPath as AnySplitPathInsideLibrary & {
							kind: typeof SplitPathKind.MdFile;
							extension: "md";
						},
					targetLocator: locator,
				});
			} else if (locator.targetKind === TreeNodeKind.File) {
				actions.push({
					actionType: "Create",
					observedSplitPath:
						observedPath as AnySplitPathInsideLibrary & {
							kind: typeof SplitPathKind.File;
							extension: string;
						},
					targetLocator: locator,
				});
			}
		}

		return actions;
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
		if (!this.clickManager) return;

		this.clickTeardown = this.clickManager.subscribe((event) => {
			if (event.kind === "CheckboxClicked") {
				this.handleCheckboxClick(event);
			}
		});
	}

	/**
	 * Handle checkbox click in a codex file.
	 */
	private handleCheckboxClick(event: CheckboxClickedEvent): void {
		// Check if file is a codex (basename starts with __)
		if (!isCodexSplitPath(event.splitPath, this.codecs)) {
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

		// Queue for processing
		void this.enqueue([action]);
	}

	/**
	 * Handle a bulk event: convert to tree actions, apply, dispatch healing.
	 */
	private async handleBulkEvent(bulk: BulkVaultEvent): Promise<void> {
		// Store for debugging
		this._debugLastBulkEvent = bulk;

		debugLog(
			`handleBulkEvent ENTRY: eventsCount=${bulk.events.length}, rootsCount=${bulk.roots.length}`,
		);
		debugLog(
			`handleBulkEvent events: ${JSON.stringify(bulk.events.map((e) => ({ from: "from" in e ? (e as any).from?.basename : undefined, kind: e.kind, to: "to" in e ? (e as any).to?.basename : undefined })))}`,
		);

		logger.info(
			"[Librarian.handleBulkEvent] ENTRY",
			JSON.stringify({
				eventsCount: bulk.events.length,
				hasHealer: !!this.healer,
				rootsCount: bulk.roots.length,
			}),
		);

		if (!this.healer) {
			debugLog("handleBulkEvent: No healer!");
			logger.warn(
				"[Librarian.handleBulkEvent] No healer, returning early",
			);
			return;
		}

		// Log received bulk event
		logger.info("[Librarian] Received bulk event:", {
			debug: bulk.debug,
			events: bulk.events.map((e) => ({
				kind: e.kind,
				...(e.kind === "FileRenamed" || e.kind === "FolderRenamed"
					? {
							from: {
								basename: e.from.basename,
								kind: e.from.kind,
								pathParts: e.from.pathParts,
							},
							to: {
								basename: e.to.basename,
								kind: e.to.kind,
								pathParts: e.to.pathParts,
							},
						}
					: {
							splitPath: {
								basename: e.splitPath.basename,
								kind: e.splitPath.kind,
								pathParts: e.splitPath.pathParts,
							},
						}),
			})),
			eventsCount: bulk.events.length,
			roots: bulk.roots.map((r) => ({
				kind: r.kind,
				...(r.kind === "FileRenamed" || r.kind === "FolderRenamed"
					? {
							from: {
								basename: r.from.basename,
								kind: r.from.kind,
								pathParts: r.from.pathParts,
							},
							to: {
								basename: r.to.basename,
								kind: r.to.kind,
								pathParts: r.to.pathParts,
							},
						}
					: {
							splitPath: {
								basename: r.splitPath.basename,
								kind: r.splitPath.kind,
								pathParts: r.splitPath.pathParts,
							},
						}),
			})),
			rootsCount: bulk.roots.length,
		});

		// Build tree actions from bulk event
		const treeActions = buildTreeActions(bulk, this.codecs, this.rules);

		// Store for debugging
		this._debugLastTreeActions = treeActions;

		debugLog(`handleBulkEvent: Built ${treeActions.length} tree actions`);
		debugLog(
			`handleBulkEvent treeActions: ${JSON.stringify(treeActions.map((a) => ({ actionType: a.actionType, targetLocator: a.targetLocator })))}`,
		);

		logger.info(
			"[Librarian.handleBulkEvent] Built tree actions:",
			JSON.stringify({
				actions: treeActions.map((a) => ({
					actionType: a.actionType,
					targetLocator: a.targetLocator,
				})),
				count: treeActions.length,
			}),
		);

		if (treeActions.length === 0) {
			debugLog("handleBulkEvent: No tree actions!");
			logger.info(
				"[Librarian.handleBulkEvent] No tree actions, returning early",
			);
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
		}
	}

	/**
	 * Wait for the queue to drain and all processing to complete.
	 * Used during init to ensure all cascading healing is done.
	 * Waits for a stable state where queue is empty and no processing is happening.
	 */
	private async waitForQueueToDrain(): Promise<void> {
		const maxWaitMs = 10000;
		const checkIntervalMs = 100;
		const stableChecksRequired = 5; // Queue must be empty for 5 consecutive checks (500ms stable)
		const startTime = Date.now();
		let stableChecks = 0;

		while (Date.now() - startTime < maxWaitMs) {
			if (this.queue.length === 0 && !this.processing) {
				stableChecks++;
				if (stableChecks >= stableChecksRequired) {
					return; // Queue is stable and empty
				}
			} else {
				stableChecks = 0; // Reset counter if queue is not empty
			}
			await new Promise((resolve) =>
				setTimeout(resolve, checkIntervalMs),
			);
		}
	}

	/**
	 * Process a batch of tree actions.
	 */
	private async processActions(
		actions: TreeAction[],
		bulkEvent: BulkVaultEvent | null,
	): Promise<void> {
		debugLog(`processActions ENTRY: ${actions.length} actions`);
		if (!this.healer) {
			debugLog("processActions: No healer!");
			return;
		}

		const allHealingActions: HealingAction[] = [];
		const allCodexImpacts: CodexImpact[] = [];

		for (const action of actions) {
			debugLog(`processActions: Processing action ${action.actionType}`);
			const result = this.healer.getHealingActionsFor(action);
			debugLog(
				`processActions: Got ${result.healingActions.length} healing actions`,
			);
			debugLog(
				`processActions healingActions: ${JSON.stringify(result.healingActions.map((h) => ({ kind: h.kind })))}`,
			);
			allHealingActions.push(...result.healingActions);
			allCodexImpacts.push(result.codexImpact);
		}

		// Extract invalid codexes from bulk event (after tree state updated)
		if (bulkEvent) {
			const invalidCodexDeletions = extractInvalidCodexesFromBulk(
				bulkEvent,
				this.codecs,
			);
			allHealingActions.push(...invalidCodexDeletions);
		}

		// Convert codex deletions to healing actions
		const mergedImpact = mergeCodexImpacts(allCodexImpacts);
		const codexDeletions = codexImpactToDeletions(
			mergedImpact,
			this.healer,
			this.codecs,
		);
		allHealingActions.push(...codexDeletions);

		// Extract scroll status changes from actions
		const scrollStatusActions = extractScrollStatusActions(
			actions,
			this.codecs,
		);

		// Generate codex recreations
		const codexRecreations = codexImpactToRecreations(
			mergedImpact,
			this.healer,
			this.codecs,
		);

		// Combine all actions and dispatch once
		const allVaultActions = [
			...healingActionsToVaultActions(allHealingActions, this.rules),
			...codexActionsToVaultActions(
				[...codexRecreations, ...scrollStatusActions],
				this.rules,
				this.codecs,
			),
		];

		// Store for debugging
		this._debugLastHealingActions = allHealingActions;
		this._debugLastVaultActions = allVaultActions;

		debugLog(
			`processActions: ${allVaultActions.length} vault actions to dispatch`,
		);
		debugLog(
			`processActions vaultActions: ${JSON.stringify(allVaultActions.map((v) => ({ kind: v.kind })))}`,
		);

		if (allVaultActions.length > 0) {
			debugLog("processActions: Dispatching vault actions...");
			await this.vaultActionManager.dispatch(allVaultActions);
			debugLog("processActions: Dispatch complete");
		} else {
			debugLog("processActions: No vault actions to dispatch");
		}
	}

	/**
	 * Cleanup: unsubscribe from vault and click events.
	 */
	unsubscribe(): void {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
		if (this.clickTeardown) {
			this.clickTeardown();
			this.clickTeardown = null;
		}
	}

	/**
	 * Get current healer (for testing).
	 */
	getHealer(): Healer | null {
		return this.healer;
	}
}
