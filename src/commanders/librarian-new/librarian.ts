import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	BulkVaultEvent,
	ObsidianVaultActionManager,
} from "../../obsidian-vault-action-manager";
import type { SplitPathWithReader } from "../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import { extractMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import { logger } from "../../utils/logger";
import { healingActionsToVaultActions } from "./library-tree/codecs/healing-to-vault-action";
import { LibraryTree } from "./library-tree/library-tree";
import { buildTreeActions } from "./library-tree/tree-action/bulk-vault-action-adapter";
import { tryParseAsInsideLibrarySplitPath } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { SplitPathInsideLibrary } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type { CreateTreeLeafAction, TreeAction } from "./library-tree/tree-action/types/tree-action";
import { tryCanonicalizeSplitPathToDestination } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator";
import { makeLocatorFromCanonicalSplitPathInsideLibrary } from "./library-tree/tree-action/utils/locator/locator-codec";
import { inferCreatePolicy } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/infer-create";
import { TreeNodeStatus, TreeNodeType } from "./library-tree/tree-node/types/atoms";

// ─── Queue ───

type QueueItem = {
	actions: TreeAction[];
	resolve: () => void;
};

// ─── Librarian ───

export class Librarian {
	private tree: LibraryTree | null = null;
	private eventTeardown: (() => void) | null = null;
	private queue: QueueItem[] = [];
	private processing = false;

	constructor(
		private readonly vaultActionManager: ObsidianVaultActionManager,
	) {}

	/**
	 * Initialize librarian: read tree and heal mismatches.
	 */
	async init(): Promise<void> {
		const settings = getParsedUserSettings();
		const rootSplitPath = settings.splitPathToLibraryRoot;
		const libraryRoot = rootSplitPath.basename;

		// Create empty tree
		this.tree = new LibraryTree(libraryRoot);

		// Read all files from library
		const allFilesResult =
			await this.vaultActionManager.listAllFilesWithMdReaders(rootSplitPath);

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
		const createActions = await this.buildInitialCreateActions(allFiles);

		// Apply all create actions and collect healing actions
		const allHealingActions: VaultAction[] = [];
		for (const action of createActions) {
			const result = this.tree.apply(action);
			const vaultActions = healingActionsToVaultActions(result.healingActions);
			allHealingActions.push(...vaultActions);
		}

		// Dispatch healing actions
		if (allHealingActions.length > 0) {
			logger.info(
				`[Librarian] Dispatching ${allHealingActions.length} healing actions`,
			);
			await this.vaultActionManager.dispatch(allHealingActions);
		}

		// Subscribe to vault events
		this.subscribeToVaultEvents();

		logger.info("[Librarian] Initialized");
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
			// Convert to library-scoped path
			const libraryScopedResult = tryParseAsInsideLibrarySplitPath(file);
			if (libraryScopedResult.isErr()) continue;
			const observedPath = libraryScopedResult.value;

			// Apply policy to get canonical destination
			// NameKing for root-level files, PathKing for nested
			const policy = inferCreatePolicy(observedPath);
			const canonicalResult = tryCanonicalizeSplitPathToDestination(
				observedPath,
				policy,
				undefined, // no rename intent for create
			);
			if (canonicalResult.isErr()) {
				logger.warn(
					`[Librarian] Failed to canonicalize ${observedPath.basename}: ${canonicalResult.error}`,
				);
				continue;
			}
			const canonicalPath = canonicalResult.value;

			// Build locator from canonical path
			const locator = makeLocatorFromCanonicalSplitPathInsideLibrary(canonicalPath);

			// Read status for md files
			let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
			if (file.type === SplitPathType.MdFile && "read" in file) {
				const contentResult = await file.read();
				if (contentResult.isOk()) {
					const meta = extractMetaInfo(contentResult.value);
					if (meta && "status" in meta) {
						status =
							meta.status === "Done"
								? TreeNodeStatus.Done
								: TreeNodeStatus.NotStarted;
					}
				}
			}

			if (locator.targetType === TreeNodeType.Scroll) {
				actions.push({
					actionType: "Create",
					targetLocator: locator,
					initialStatus: status,
					observedSplitPath: observedPath as SplitPathInsideLibrary & {
						type: typeof SplitPathType.MdFile;
						extension: "md";
					},
				});
			} else {
				actions.push({
					actionType: "Create",
					targetLocator: locator,
					observedSplitPath: observedPath as SplitPathInsideLibrary & {
						type: typeof SplitPathType.File;
						extension: string;
					},
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
				logger.debug("[Librarian] Received bulk event", bulk.debug);
				await this.handleBulkEvent(bulk);
			},
		);
	}

	/**
	 * Handle a bulk event: convert to tree actions, apply, dispatch healing.
	 */
	private async handleBulkEvent(bulk: BulkVaultEvent): Promise<void> {
		if (!this.tree) {
			logger.warn("[Librarian] Tree not initialized, skipping event");
			return;
		}

		// Build tree actions from bulk event
		const treeActions = buildTreeActions(bulk);

		if (treeActions.length === 0) {
			return;
		}

		// Queue and process
		await this.enqueue(treeActions);
	}

	/**
	 * Enqueue tree actions for processing.
	 * Ensures serial processing of batches.
	 */
	private enqueue(actions: TreeAction[]): Promise<void> {
		return new Promise((resolve) => {
			this.queue.push({ actions, resolve });
			this.processQueue();
		});
	}

	/**
	 * Process queued actions one batch at a time.
	 */
	private async processQueue(): Promise<void> {
		if (this.processing) return;
		this.processing = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift();
			if (!item) continue;

			try {
				await this.processActions(item.actions);
			} catch (error) {
				logger.error("[Librarian] Error processing actions:", error);
			}

			item.resolve();
		}

		this.processing = false;
	}

	/**
	 * Process a batch of tree actions.
	 */
	private async processActions(actions: TreeAction[]): Promise<void> {
		if (!this.tree) return;

		const allHealingActions: VaultAction[] = [];

		for (const action of actions) {
			const result = this.tree.apply(action);
			const vaultActions = healingActionsToVaultActions(result.healingActions);
			allHealingActions.push(...vaultActions);
		}

		if (allHealingActions.length > 0) {
			logger.info(
				`[Librarian] Dispatching ${allHealingActions.length} healing actions`,
			);
			await this.vaultActionManager.dispatch(allHealingActions);
		}
	}

	/**
	 * Cleanup: unsubscribe from vault events.
	 */
	unsubscribeFromVaultEvents(): void {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
	}

	/**
	 * Get current tree (for testing).
	 */
	getTree(): LibraryTree | null {
		return this.tree;
	}
}
