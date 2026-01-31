import { getParsedUserSettings } from "../../global-state/global-state";
import type { UserCommandKind } from "../../managers/actions-manager/types";
import type { CheckboxPayload } from "../../managers/obsidian/user-event-interceptor";
import type {
	BulkVaultEvent,
	VaultAction,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import { MD } from "../../managers/obsidian/vault-action-manager/types/literals";
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
import type {
	ScrollNodeLocator,
	SectionNodeLocator,
} from "./codecs/locator/types";
import { Healer } from "./healer/healer";
import { HealingTransaction } from "./healer/healing-transaction";
import {
	type CodexClickTarget,
	type CodexImpact,
	extractInvalidCodexesFromBulk,
	parseCodexClickLineContent,
} from "./healer/library-tree/codex";
import { isCodexInsideLibrary as isCodexInsideLibraryHelper } from "./healer/library-tree/codex/helpers";
import { Tree } from "./healer/library-tree/tree";
import { buildTreeActions } from "./healer/library-tree/tree-action/bulk-vault-action-adapter";
import type {
	ChangeNodeStatusAction,
	TreeAction,
} from "./healer/library-tree/tree-action/types/tree-action";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "./healer/library-tree/tree-node/types/atoms";
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
import {
	buildPageNavMigrationActions,
	triggerSectionHealing as triggerSectionHealingImpl,
} from "./section-healing";
import { PREFIX_OF_CODEX } from "./types/consts/literals";
import type { NodeName } from "./types/schemas/node-name";
import { VaultActionQueue } from "./vault-action-queue";
import { resolveAliasFromSuffix } from "./wikilink-alias";

// ─── Queue Item ───

type LibrarianQueueItem = {
	treeActions: TreeAction[];
	invalidCodexActions: HealingAction[];
};

// ─── Librarian ───

export class Librarian {
	private healer: Healer | null = null;
	private eventTeardown: (() => void) | null = null;
	private actionQueue: VaultActionQueue<LibrarianQueueItem>;
	private codecs!: Codecs;
	private rules!: CodecRules;

	// Debug: store last events and actions for testing
	public _debugLastBulkEvent: BulkVaultEvent | null = null;
	public _debugLastTreeActions: TreeAction[] = [];
	public _debugLastHealingActions: HealingAction[] = [];
	public _debugLastVaultActions: VaultAction[] = [];

	constructor(private readonly vaultActionManager: VaultActionManager) {
		this.actionQueue = new VaultActionQueue<LibrarianQueueItem>(
			(item) =>
				this.processActions(item.treeActions, item.invalidCodexActions),
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

			// Process codex impacts: merge, compute deletions and recreations
			const { deletionHealingActions, codexRecreations } =
				processCodexImpactsForInit(
					allCodexImpacts,
					this.healer,
					this.codecs,
				);
			allHealingActions.push(...deletionHealingActions);

			// Build page navigation migration actions
			const pageNavMigrationActions = await buildPageNavMigrationActions(
				allFiles,
				this.rules,
			);

			// Combine all actions and dispatch once
			const allVaultActions = [
				...assembleVaultActions(
					allHealingActions,
					codexRecreations,
					this.rules,
					this.codecs,
				),
				...migrationActions, // Convert YAML frontmatter to internal format
				...pageNavMigrationActions, // Add missing page navigation indices
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

		// Extract invalid codex deletions from bulk event
		const invalidCodexActions = extractInvalidCodexesFromBulk(
			bulk,
			this.codecs,
		);

		// Store for debugging
		this._debugLastTreeActions = treeActions;

		if (treeActions.length === 0 && invalidCodexActions.length === 0) {
			return;
		}

		// Queue and process
		await this.actionQueue.enqueue({
			invalidCodexActions,
			treeActions,
		});
	}

	/**
	 * Process a batch of tree actions.
	 */
	private async processActions(
		treeActions: TreeAction[],
		invalidCodexActions: HealingAction[],
	): Promise<void> {
		if (!this.healer) {
			return;
		}

		// Apply all tree actions via HealingTransaction
		const tx = new HealingTransaction(this.healer);
		for (const action of treeActions) {
			const result = tx.apply(action);
			if (result.isErr()) {
				tx.logSummary("error");
				logger.error("[Librarian] Transaction failed:", result.error);
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
	 * Cleanup: unsubscribe from vault events.
	 */
	async unsubscribe(): Promise<void> {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
		// Wait for queue to drain
		await this.actionQueue.waitForDrain();
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

	isCodexInsideLibrary(splitPath: SplitPathToMdFile): boolean {
		return isCodexInsideLibraryHelper(splitPath, this.rules);
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
	 * Handle checkbox click in a codex file.
	 * Parses the line content to determine the target (scroll or section),
	 * builds a ChangeNodeStatusAction, and enqueues it for processing.
	 */
	async handleCodexCheckboxClick(payload: CheckboxPayload): Promise<void> {
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

		// 2. Determine new status from intended toggle
		// payload.checked is the CURRENT state at mousedown time (before toggle)
		// User clicked to TOGGLE, so intended new state is the opposite
		const newStatus = payload.checked
			? TreeNodeStatus.NotStarted // Currently checked -> user wants to uncheck
			: TreeNodeStatus.Done; // Currently unchecked -> user wants to check

		// 3. Build ChangeNodeStatusAction based on target type
		const action = this.buildChangeStatusAction(target, newStatus);
		if (!action) {
			logger.warn(
				"[Librarian.handleCodexCheckboxClick] Failed to build action",
			);
			return;
		}

		// 4. Enqueue for processing
		await this.actionQueue.enqueue({
			invalidCodexActions: [],
			treeActions: [action],
		});
	}

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
