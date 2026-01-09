import { z } from "zod";
import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	CheckboxClickedEvent,
	ClickManager,
} from "../../managers/obsidian/click-manager";
import type {
	BulkVaultEvent,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import type { SplitPathWithReader } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathType } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { readMetadata } from "../../managers/pure/note-metadata-manager";
import { logger } from "../../utils/logger";
import { healingActionsToVaultActions } from "./library-tree/codecs/healing-to-vault-action";
import {
	CODEX_CORE_NAME,
	type CodexAction,
	type CodexImpact,
	codexActionsToVaultActions,
	codexImpactToActions,
	computeCodexSplitPath,
	parseCodexClickLineContent,
	type WriteScrollStatusAction,
} from "./library-tree/codex";
import { mergeCodexImpacts } from "./library-tree/codex/merge-codex-impacts";
import { LibraryTree } from "./library-tree/library-tree";
import { buildTreeActions } from "./library-tree/tree-action/bulk-vault-action-adapter";
import { tryParseAsInsideLibrarySplitPath } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { SplitPathInsideLibrary } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import { inferCreatePolicy } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/infer-create";
import { tryCanonicalizeSplitPathToDestination } from "./library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator";
import type {
	CreateTreeLeafAction,
	TreeAction,
} from "./library-tree/tree-action/types/tree-action";
import {
	makeJoinedSuffixedBasename,
	makeSuffixPartsFromPathPartsWithRoot,
	tryParseAsSeparatedSuffixedBasename,
} from "./library-tree/tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { makeLocatorFromCanonicalSplitPathInsideLibrary } from "./library-tree/tree-action/utils/locator/locator-codec";
import { makeNodeSegmentId } from "./library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import {
	TreeNodeStatus,
	TreeNodeType,
} from "./library-tree/tree-node/types/atoms";
import {
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
} from "./library-tree/tree-node/types/node-segment-id";
import type { SectionNode } from "./library-tree/tree-node/types/tree-node";
import type { HealingAction } from "./library-tree/types/healing-action";
import { resolveDuplicateHealingActions } from "./library-tree/utils/resolve-duplicate-healing";

// ─── Scroll Metadata Schema ───

const ScrollMetadataSchema = z.object({
	status: z.enum(["Done", "NotStarted"]),
});

// ─── Queue ───

type QueueItem = {
	actions: TreeAction[];
	resolve: () => void;
};

// ─── Librarian ───

export class Librarian {
	private tree: LibraryTree | null = null;
	private eventTeardown: (() => void) | null = null;
	private clickTeardown: (() => void) | null = null;
	private queue: QueueItem[] = [];
	private processing = false;

	constructor(
		private readonly vaultActionManager: VaultActionManager,
		private readonly clickManager?: ClickManager,
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
		const createActions = await this.buildInitialCreateActions(allFiles);

		// Apply all create actions and collect healing + codex impacts
		const allHealingActions: HealingAction[] = [];
		const allCodexImpacts: CodexImpact[] = [];

		for (const action of createActions) {
			const result = this.tree.apply(action);
			allHealingActions.push(...result.healingActions);
			allCodexImpacts.push(result.codexImpact);
		}

		// Delete invalid codex files (orphaned __ files)
		const invalidCodexActions = this.findInvalidCodexFiles(allFiles);
		allHealingActions.push(...invalidCodexActions);

		// Dispatch healing actions first
		if (allHealingActions.length > 0) {
			const vaultActions =
				healingActionsToVaultActions(allHealingActions);
			await this.vaultActionManager.dispatch(vaultActions);
		}

		// Then dispatch codex actions
		const mergedImpact = mergeCodexImpacts(allCodexImpacts);
		const codexActions = codexImpactToActions(mergedImpact, this.tree);
		const codexVaultActions = codexActionsToVaultActions(codexActions);

		if (codexVaultActions.length > 0) {
			await this.vaultActionManager.dispatch(codexVaultActions);
		}

		// Subscribe to vault events
		this.subscribeToVaultEvents();

		// Subscribe to click events
		this.subscribeToClickEvents();
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
			const coreNameResult = tryParseAsSeparatedSuffixedBasename(file);
			if (
				coreNameResult.isOk() &&
				coreNameResult.value.coreName === CODEX_CORE_NAME
			) {
				continue;
			}

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
				continue;
			}
			const canonicalPath = canonicalResult.value;

			// Build locator from canonical path
			const locator =
				makeLocatorFromCanonicalSplitPathInsideLibrary(canonicalPath);

			// Read status for md files
			let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
			if (file.type === SplitPathType.MdFile && "read" in file) {
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

			if (locator.targetType === TreeNodeType.Scroll) {
				actions.push({
					actionType: "Create",
					initialStatus: status,
					observedSplitPath:
						observedPath as SplitPathInsideLibrary & {
							type: typeof SplitPathType.MdFile;
							extension: "md";
						},
					targetLocator: locator,
				});
			} else {
				actions.push({
					actionType: "Create",
					observedSplitPath:
						observedPath as SplitPathInsideLibrary & {
							type: typeof SplitPathType.File;
							extension: string;
						},
					targetLocator: locator,
				});
			}
		}

		return actions;
	}

	/**
	 * Find invalid codex files (__ prefix but not valid codexes) and return delete actions.
	 */
	private findInvalidCodexFiles(
		allFiles: SplitPathWithReader[],
	): HealingAction[] {
		if (!this.tree) return [];

		// Collect all valid codex paths from tree
		const validCodexPaths = new Set<string>();
		this.collectValidCodexPaths(this.tree.getRoot(), [], validCodexPaths);

		const deleteActions: HealingAction[] = [];

		for (const file of allFiles) {
			// Skip non-md files
			if (file.type !== SplitPathType.MdFile) continue;

			// Check if basename starts with __
			const coreNameResult = tryParseAsSeparatedSuffixedBasename(file);
			if (coreNameResult.isErr()) continue;

			if (coreNameResult.value.coreName !== CODEX_CORE_NAME) continue;

			// This is a __ file - check if it's valid
			const libraryScopedResult = tryParseAsInsideLibrarySplitPath(file);
			if (libraryScopedResult.isErr()) continue;

			const filePath = [
				...libraryScopedResult.value.pathParts,
				libraryScopedResult.value.basename,
			].join("/");

			if (!validCodexPaths.has(filePath)) {
				deleteActions.push({
					payload: { splitPath: libraryScopedResult.value },
					type: "DeleteMdFile",
				});
			}
		}

		return deleteActions;
	}

	/**
	 * Recursively collect all valid codex paths from the tree.
	 */
	private collectValidCodexPaths(
		section: SectionNode,
		parentChain: SectionNodeSegmentId[],
		paths: Set<string>,
	): void {
		// Current section's chain
		const currentSegmentId = makeNodeSegmentId(section);
		const currentChain = [...parentChain, currentSegmentId];

		// Compute codex path for this section
		const codexSplitPath = computeCodexSplitPath(currentChain);
		const codexPath = [
			...codexSplitPath.pathParts,
			codexSplitPath.basename,
		].join("/");
		paths.add(codexPath);

		// Recurse into child sections
		for (const child of Object.values(section.children)) {
			if (child.type === TreeNodeType.Section) {
				this.collectValidCodexPaths(child, currentChain, paths);
			}
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
		if (!this.clickManager) return;

		this.clickTeardown = this.clickManager.subscribe((event) => {
			if (event.type === "CheckboxClicked") {
				this.handleCheckboxClick(event);
			}
		});
	}

	/**
	 * Handle checkbox click in a codex file.
	 */
	private handleCheckboxClick(event: CheckboxClickedEvent): void {
		// Check if file is a codex (basename starts with __)
		const coreNameResult = tryParseAsSeparatedSuffixedBasename(
			event.splitPath,
		);
		if (coreNameResult.isErr()) return;

		if (coreNameResult.value.coreName !== CODEX_CORE_NAME) {
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

		if (target.type === "Scroll") {
			action = {
				actionType: "ChangeStatus",
				newStatus,
				targetLocator: {
					segmentId:
						`${target.nodeName}${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md` as ScrollNodeSegmentId,
					segmentIdChainToParent: target.parentChain,
					targetType: TreeNodeType.Scroll,
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
					targetType: TreeNodeType.Section,
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
		if (!this.tree) {
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

		const allHealingActions: HealingAction[] = [];
		const allCodexImpacts: CodexImpact[] = [];

		for (const action of actions) {
			const result = this.tree.apply(action);
			allHealingActions.push(...result.healingActions);
			allCodexImpacts.push(result.codexImpact);
		}

		// 1. Dispatch healing actions first
		if (allHealingActions.length > 0) {
			const resolvedActions = await resolveDuplicateHealingActions(
				allHealingActions,
				this.vaultActionManager,
			);

			const vaultActions = healingActionsToVaultActions(resolvedActions);

			if (vaultActions.length > 0) {
				await this.vaultActionManager.dispatch(vaultActions);
			}
		}

		// 2. Extract scroll status changes from actions
		const scrollStatusActions = this.extractScrollStatusActions(actions);

		// 3. Then dispatch codex actions
		const mergedImpact = mergeCodexImpacts(allCodexImpacts);
		const codexActions = codexImpactToActions(mergedImpact, this.tree);
		// Merge scroll status actions with codex actions
		const allCodexActions: CodexAction[] = [
			...codexActions,
			...scrollStatusActions,
		];
		const codexVaultActions = codexActionsToVaultActions(allCodexActions);

		if (codexVaultActions.length > 0) {
			await this.vaultActionManager.dispatch(codexVaultActions);
		}
	}

	/**
	 * Extract WriteScrollStatusAction from ChangeStatus actions on scrolls.
	 */
	private extractScrollStatusActions(
		actions: TreeAction[],
	): WriteScrollStatusAction[] {
		const scrollActions: WriteScrollStatusAction[] = [];

		for (const action of actions) {
			if (
				action.actionType !== "ChangeStatus" ||
				action.targetLocator.targetType !== TreeNodeType.Scroll
			) {
				continue;
			}

			const nodeName = this.extractNodeNameFromScrollSegmentId(
				action.targetLocator.segmentId,
			);
			const parentChain = action.targetLocator.segmentIdChainToParent;
			const splitPath = this.computeScrollSplitPath(
				nodeName,
				parentChain,
			);

			scrollActions.push({
				payload: {
					splitPath,
					status: action.newStatus,
				},
				type: "WriteScrollStatus",
			});
		}

		return scrollActions;
	}

	/**
	 * Extract node name from scroll segment ID (format: "nodeName﹘Scroll﹘md").
	 */
	private extractNodeNameFromScrollSegmentId(
		segmentId: ScrollNodeSegmentId,
	): string {
		const [raw] = segmentId.split(NodeSegmentIdSeparator, 1);
		return raw ?? "";
	}

	/**
	 * Compute split path for a scroll given its node name and parent chain.
	 */
	private computeScrollSplitPath(
		nodeName: string,
		parentChain: SectionNodeSegmentId[],
	): SplitPathInsideLibrary & {
		type: typeof SplitPathType.MdFile;
		extension: "md";
	} {
		const pathParts = parentChain.map((segId) => {
			const [raw] = segId.split(NodeSegmentIdSeparator, 1);
			return raw ?? "";
		});
		const suffixParts = makeSuffixPartsFromPathPartsWithRoot(pathParts);

		const basename = makeJoinedSuffixedBasename({
			coreName: nodeName,
			suffixParts,
		});

		return {
			basename,
			extension: "md",
			pathParts,
			type: SplitPathType.MdFile,
		};
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
	 * Get current tree (for testing).
	 */
	getTree(): LibraryTree | null {
		return this.tree;
	}
}
