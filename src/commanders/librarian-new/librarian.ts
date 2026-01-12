import { ok, type Result } from "neverthrow";
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
import { SplitPathKind } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { readMetadata } from "../../managers/pure/note-metadata-manager";
import { decrementPending, incrementPending } from "../../utils/idle-tracker";
import { logger } from "../../utils/logger";
import type { AnySplitPathInsideLibrary } from "./codecs";
import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "./codecs";
import { healingActionsToVaultActions } from "./codecs/healing-to-vault-action";
import type { CanonicalSplitPathToMdFileInsideLibrary } from "./codecs/locator";
import type { ScrollNodeLocator } from "./codecs/locator/types";
import { Healer } from "./healer/healer";
import {
	CODEX_CORE_NAME,
	type CodexAction,
	type CodexImpact,
	codexActionsToVaultActions,
	codexImpactToActions,
	computeCodexSplitPath,
	parseCodexClickLineContent,
	type WriteScrollStatusAction,
} from "./healer/library-tree/codex";
import { mergeCodexImpacts } from "./healer/library-tree/codex/merge-codex-impacts";
import { Tree } from "./healer/library-tree/tree";
import { buildTreeActions } from "./healer/library-tree/tree-action/bulk-vault-action-adapter";
import { tryParseAsInsideLibrarySplitPath } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import { inferCreatePolicy } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/infer-create";
import { tryCanonicalizeSplitPathToDestination } from "./healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator";
import type {
	CreateTreeLeafAction,
	TreeAction,
} from "./healer/library-tree/tree-action/types/tree-action";
import { makeNodeSegmentId } from "./healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "./healer/library-tree/tree-node/types/atoms";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "./healer/library-tree/tree-node/types/node-segment-id";
import type { SectionNode } from "./healer/library-tree/tree-node/types/tree-node";
import type { HealingAction } from "./healer/library-tree/types/healing-action";
import { resolveDuplicateHealingActions } from "./healer/library-tree/utils/resolve-duplicate-healing";

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
	private healer: Healer | null = null;
	private eventTeardown: (() => void) | null = null;
	private clickTeardown: (() => void) | null = null;
	private queue: QueueItem[] = [];
	private processing = false;
	private codecs: Codecs;
	private rules: CodecRules;

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

			// Build Create actions for each file
			const createActions =
				await this.buildInitialCreateActions(allFiles);

			// Apply all create actions and collect healing + codex impacts
			const allHealingActions: HealingAction[] = [];
			const allCodexImpacts: CodexImpact[] = [];

			for (const action of createActions) {
				const result = this.healer.getHealingActionsFor(action);
				allHealingActions.push(...result.healingActions);
				allCodexImpacts.push(result.codexImpact);
			}

			// Delete invalid codex files (orphaned __ files)
			const invalidCodexActions = this.findInvalidCodexFiles(allFiles);
			allHealingActions.push(...invalidCodexActions);

			// Subscribe to vault events BEFORE dispatching actions
			// This ensures we catch all events, including cascading healing from init actions
			this.subscribeToVaultEvents();

			// Subscribe to click events
			this.subscribeToClickEvents();

			// Dispatch healing actions first
			if (allHealingActions.length > 0) {
				const vaultActions = healingActionsToVaultActions(
					allHealingActions,
					this.rules,
				);
				await this.vaultActionManager.dispatch(vaultActions);
			}

			// Then dispatch codex actions
			const mergedImpact = mergeCodexImpacts(allCodexImpacts);
			const codexActions = codexImpactToActions(
				mergedImpact,
				this.healer,
				this.codecs,
			);
			const codexVaultActions = codexActionsToVaultActions(codexActions);

			if (codexVaultActions.length > 0) {
				await this.vaultActionManager.dispatch(codexVaultActions);
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
			const coreNameResult =
				this.codecs.canonicalSplitPath.parseSeparatedSuffix(
					file.basename,
				);
			if (
				coreNameResult.isOk() &&
				coreNameResult.value.coreName === CODEX_CORE_NAME
			) {
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
	 * Find invalid codex files (__ prefix but not valid codexes) and return delete actions.
	 */
	private findInvalidCodexFiles(
		allFiles: SplitPathWithReader[],
	): HealingAction[] {
		if (!this.healer) return [];

		// Collect all valid codex paths from tree
		const validCodexPaths = new Set<string>();
		this.collectValidCodexPaths(this.healer.getRoot(), [], validCodexPaths);

		const deleteActions: HealingAction[] = [];

		for (const file of allFiles) {
			// Skip non-md files
			if (file.kind !== SplitPathKind.MdFile) continue;

			// Check if basename starts with __
			const coreNameResult =
				this.codecs.canonicalSplitPath.parseSeparatedSuffix(
					file.basename,
				);
			if (coreNameResult.isErr()) continue;

			if (coreNameResult.value.coreName !== CODEX_CORE_NAME) continue;

			// This is a __ file - check if it's valid
			const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
				file,
				this.rules,
			);
			if (libraryScopedResult.isErr()) continue;

			const filePath = [
				...libraryScopedResult.value.pathParts,
				libraryScopedResult.value.basename,
			].join("/");

			if (!validCodexPaths.has(filePath)) {
				deleteActions.push({
					kind: "DeleteMdFile",
					payload: { splitPath: libraryScopedResult.value },
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
		const codexSplitPath = computeCodexSplitPath(currentChain, this.codecs);
		const codexPath = [
			...codexSplitPath.pathParts,
			codexSplitPath.basename,
		].join("/");
		paths.add(codexPath);

		// Recurse into child sections
		for (const child of Object.values(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
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
		const coreNameResult =
			this.codecs.canonicalSplitPath.parseSeparatedSuffix(
				event.splitPath.basename,
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
		if (!this.healer) {
			return;
		}

		// Build tree actions from bulk event
		const treeActions = buildTreeActions(bulk, this.codecs, this.rules);

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
		incrementPending();

		try {
			while (this.queue.length > 0) {
				const item = this.queue.shift();
				if (!item) continue;

				try {
					await this.processActions(item.actions);
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
	private async processActions(actions: TreeAction[]): Promise<void> {
		if (!this.healer) return;

		const allHealingActions: HealingAction[] = [];
		const allCodexImpacts: CodexImpact[] = [];

		for (const action of actions) {
			const result = this.healer.getHealingActionsFor(action);
			allHealingActions.push(...result.healingActions);
			allCodexImpacts.push(result.codexImpact);
		}

		// 1. Dispatch healing actions first
		if (allHealingActions.length > 0) {
			const resolvedActions = await resolveDuplicateHealingActions(
				allHealingActions,
				this.vaultActionManager,
			);

			const vaultActions = healingActionsToVaultActions(
				resolvedActions,
				this.rules,
			);

			if (vaultActions.length > 0) {
				await this.vaultActionManager.dispatch(vaultActions);
			}
		}

		// 2. Extract scroll status changes from actions
		const scrollStatusActions = this.extractScrollStatusActions(actions);

		// 3. Then dispatch codex actions
		const mergedImpact = mergeCodexImpacts(allCodexImpacts);
		const codexActions = codexImpactToActions(
			mergedImpact,
			this.healer,
			this.codecs,
		);
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
				action.targetLocator.targetKind !== TreeNodeKind.Scroll
			) {
				continue;
			}

			const nodeNameResult = this.extractNodeNameFromScrollSegmentId(
				action.targetLocator.segmentId,
			);
			if (nodeNameResult.isErr()) {
				logger.error(
					"[Librarian] Failed to parse scroll segment ID:",
					nodeNameResult.error,
				);
				continue;
			}
			const nodeName = nodeNameResult.value;

			const parentChain = action.targetLocator.segmentIdChainToParent;
			const splitPathResult = this.computeScrollSplitPath(
				nodeName,
				parentChain,
			);
			if (splitPathResult.isErr()) {
				logger.error(
					"[Librarian] Failed to compute scroll split path:",
					splitPathResult.error,
				);
				continue;
			}
			const splitPath = splitPathResult.value;

			scrollActions.push({
				kind: "WriteScrollStatus",
				payload: {
					splitPath,
					status: action.newStatus,
				},
			});
		}

		return scrollActions;
	}

	/**
	 * Extract node name from scroll segment ID using codec API.
	 */
	private extractNodeNameFromScrollSegmentId(
		segmentId: ScrollNodeSegmentId,
	): Result<string, import("./codecs/errors").CodecError> {
		const parseResult =
			this.codecs.segmentId.parseScrollSegmentId(segmentId);
		if (parseResult.isErr()) {
			return parseResult;
		}
		return parseResult.map((components) => components.coreName);
	}

	/**
	 * Compute split path for a scroll given its node name and parent chain.
	 */
	private computeScrollSplitPath(
		nodeName: string,
		parentChain: SectionNodeSegmentId[],
	): Result<
		AnySplitPathInsideLibrary & {
			kind: typeof SplitPathKind.MdFile;
			extension: "md";
		},
		import("./codecs/errors").CodecError
	> {
		// Build segmentIdChainToParent by parsing each segment ID
		const segmentIdChainToParent: SectionNodeSegmentId[] = [];
		for (const segId of parentChain) {
			const parseResult =
				this.codecs.segmentId.parseSectionSegmentId(segId);
			if (parseResult.isErr()) {
				return parseResult;
			}
			// Keep original segment ID (already validated)
			segmentIdChainToParent.push(segId);
		}

		// Create ScrollNodeSegmentId
		const segmentIdResult =
			this.codecs.segmentId.serializeSegmentIdUnchecked({
				coreName: nodeName,
				extension: "md",
				targetKind: TreeNodeKind.Scroll,
			});
		if (segmentIdResult.isErr()) {
			return segmentIdResult;
		}

		// Construct ScrollNodeLocator
		const locator: ScrollNodeLocator = {
			segmentId: segmentIdResult.value as ScrollNodeSegmentId,
			segmentIdChainToParent,
			targetKind: TreeNodeKind.Scroll,
		};

		// Convert locator to canonical split path, then to split path
		const canonicalResult =
			this.codecs.locator.locatorToCanonicalSplitPathInsideLibrary(
				locator,
			);

		// Chain: canonical -> split path
		return canonicalResult.andThen((canonical) => {
			// Type assertion: we know it's a Scroll, so result is CanonicalSplitPathToMdFileInsideLibrary
			const canonicalScroll =
				canonical as CanonicalSplitPathToMdFileInsideLibrary;

			// Convert canonical to split path
			const splitPath =
				this.codecs.canonicalSplitPath.fromCanonicalSplitPathInsideLibrary(
					canonicalScroll,
				);

			return ok(
				splitPath as AnySplitPathInsideLibrary & {
					kind: typeof SplitPathKind.MdFile;
					extension: "md";
				},
			);
		});
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
