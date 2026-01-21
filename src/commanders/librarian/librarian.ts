import { getParsedUserSettings } from "../../global-state/global-state";
import {
	buildGoBackLinkPattern,
	isGoBackLine,
} from "../../managers/obsidian/navigation";
import type {
	CheckboxClickedEvent,
	ClipboardCopyEvent,
	PropertyCheckboxClickedEvent,
	SelectAllEvent,
	UserEventInterceptor,
	WikilinkCompletedEvent,
} from "../../managers/obsidian/user-event-interceptor";
import { InterceptableUserEventKind } from "../../managers/obsidian/user-event-interceptor/types/user-event";
import type {
	BulkVaultEvent,
	VaultAction,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import { MD } from "../../managers/obsidian/vault-action-manager/types/literals";
import {
	SplitPathKind,
	type SplitPathToMdFileWithReader,
} from "../../managers/obsidian/vault-action-manager/types/split-path";
import { META_SECTION_PATTERN } from "../../managers/pure/note-metadata-manager";
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
import type { ScrollNodeSegmentId } from "./codecs/segment-id/types/segment-id";
import { Healer } from "./healer/healer";
import { HealingTransaction } from "./healer/healing-transaction";
import type { CodexImpact } from "./healer/library-tree/codex";
import {
	extractInvalidCodexesFromBulk,
	parseCodexClickLineContent,
} from "./healer/library-tree/codex";
import { isCodexSplitPath } from "./healer/library-tree/codex/helpers";
import {
	splitFirstLine,
	splitFrontmatter,
} from "./healer/library-tree/codex/transforms/transform-utils";
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
import { scanAndGenerateOrphanActions } from "./healer/orphan-codex-scanner";
import {
	assembleVaultActions,
	buildInitialCreateActions,
	processCodexImpacts,
	processCodexImpactsForInit,
} from "./librarian-init";

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
	private userEventTeardown: (() => void) | null = null;
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
		private readonly userEventInterceptor?: UserEventInterceptor,
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
			const { cleanupActions, scanResult } = scanAndGenerateOrphanActions(
				this.healer,
				this.codecs,
				mdPaths,
			);
			if (scanResult.orphans.length > 0) {
				logger.info(
					`[Librarian] Found ${scanResult.orphans.length} orphaned codexes`,
				);
			}
			allHealingActions.push(...cleanupActions);

			// Subscribe to vault events BEFORE dispatching actions
			// This ensures we catch all events, including cascading healing from init actions
			this.subscribeToVaultEvents();

			// Subscribe to user events (clicks, clipboard, select-all, wikilinks)
			this.subscribeToUserEvents();

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
	 * Subscribe to user events (clicks, clipboard, select-all, wikilinks).
	 */
	private subscribeToUserEvents(): void {
		if (!this.userEventInterceptor) {
			logger.info(
				"[Librarian] no userEventInterceptor, skipping subscription",
			);
			return;
		}

		logger.info("[Librarian] subscribing to user events");
		this.userEventTeardown = this.userEventInterceptor.subscribe(
			(event) => {
				switch (event.kind) {
					case InterceptableUserEventKind.CheckboxClicked:
						this.handleCheckboxClick(event);
						break;
					case InterceptableUserEventKind.PropertyCheckboxClicked:
						this.handlePropertyCheckboxClick(event);
						break;
					case InterceptableUserEventKind.WikilinkCompleted:
						this.handleWikilinkCompleted(event);
						break;
					case InterceptableUserEventKind.ClipboardCopy:
						this.handleClipboardCopy(event);
						break;
					case InterceptableUserEventKind.SelectAll:
						this.handleSelectAll(event);
						break;
				}
			},
		);
		logger.info("[Librarian] subscribed to user events");
	}

	/**
	 * Handle wikilink completion: add alias for library files.
	 * If basename has suffix parts (delimiter-separated), it's a library file.
	 */
	private handleWikilinkCompleted(event: WikilinkCompletedEvent): void {
		const { linkContent, closePos, insertAlias } = event;

		logger.info(
			"[Librarian] handleWikilinkCompleted received:",
			JSON.stringify({ closePos, linkContent }),
		);

		// Parse basename to extract suffix parts
		const parseResult =
			this.codecs.suffix.parseSeparatedSuffix(linkContent);
		if (parseResult.isErr()) {
			logger.info(
				"[Librarian] parseSeparatedSuffix failed:",
				JSON.stringify({ error: parseResult.error, linkContent }),
			);
			return;
		}

		const { coreName, suffixParts } = parseResult.value;
		logger.info(
			"[Librarian] parsed suffix:",
			JSON.stringify({ coreName, suffixParts }),
		);

		// Skip codex files (start with __)
		if (coreName.startsWith("__")) {
			logger.info("[Librarian] skipping codex file (__ prefix)");
			return;
		}

		// No suffix = not a library file (or root-level file without hierarchy)
		if (suffixParts.length === 0) {
			logger.info("[Librarian] no suffix parts, skipping");
			return;
		}

		// Has suffix parts = library file, add alias
		logger.info(
			"[Librarian] inserting alias:",
			JSON.stringify({ alias: coreName, closePos }),
		);

		insertAlias(coreName);

		logger.info(
			"[Librarian] Inserted wikilink alias:",
			JSON.stringify({ coreName, linkContent }),
		);
	}

	/**
	 * Handle clipboard copy: strip metadata and go-back links from copied text.
	 */
	private handleClipboardCopy(event: ClipboardCopyEvent): void {
		const { originalText, preventDefault, setClipboardData } = event;

		const goBackPattern = buildGoBackLinkPattern();
		const withoutGoBack = originalText.replace(goBackPattern, "");
		const withoutMeta = withoutGoBack.replace(META_SECTION_PATTERN, "");

		// Only intercept if we actually stripped metadata/links
		const strippedContent =
			withoutGoBack.length < originalText.length ||
			withoutMeta.length < withoutGoBack.length;

		if (!strippedContent) return; // Let native copy handle it

		preventDefault();
		setClipboardData(withoutMeta.trim());
	}

	/**
	 * Handle select-all: use smart range excluding frontmatter, go-back links, metadata.
	 */
	private handleSelectAll(event: SelectAllEvent): void {
		const { content, preventDefault, setSelection } = event;

		const { from, to } = this.calculateSmartRange(content);

		// If the range covers everything or nothing, let default behavior handle it
		if ((from === 0 && to === content.length) || from >= to) {
			return;
		}

		preventDefault();
		setSelection(from, to);
	}

	/**
	 * Calculate smart selection range that excludes:
	 * 1. YAML frontmatter (--- ... ---)
	 * 2. Go-back links at the start ([[__...]])
	 * 3. Metadata section at the end (<section id="textfresser_meta...">)
	 */
	private calculateSmartRange(content: string): { from: number; to: number } {
		if (!content || content.length === 0) {
			return { from: 0, to: 0 };
		}

		let from = 0;
		let to = content.length;

		// Step 1: Skip frontmatter
		const { frontmatter } = splitFrontmatter(content);
		if (frontmatter) {
			from = frontmatter.length;
		}

		// Step 2: Skip leading whitespace/empty lines, then check for go-back link
		const contentAfterFrontmatter = content.slice(from);
		if (contentAfterFrontmatter.length > 0) {
			let searchPos = 0;
			let currentLine = "";

			while (searchPos < contentAfterFrontmatter.length) {
				const remaining = contentAfterFrontmatter.slice(searchPos);
				const { firstLine, rest } = splitFirstLine(remaining);

				if (firstLine.trim().length === 0) {
					searchPos += firstLine.length;
					if (
						rest.length > 0 ||
						remaining[firstLine.length] === "\n"
					) {
						searchPos += 1;
					}
				} else {
					currentLine = firstLine;
					break;
				}
			}

			if (isGoBackLine(currentLine)) {
				from += searchPos + currentLine.length;
				if (from < content.length && content[from] === "\n") {
					from += 1;
				}
			}
		}

		// Step 3: Find metadata section start
		const metaMatch = content.match(META_SECTION_PATTERN);
		if (metaMatch && metaMatch.index !== undefined) {
			to = metaMatch.index;
		}

		// Trim trailing whitespace from selection
		while (to > from && /\s/.test(content[to - 1])) {
			to--;
		}

		// Trim leading whitespace from selection (after go-back link)
		while (from < to && /\s/.test(content[from])) {
			from++;
		}

		// Handle edge case where everything is excluded
		if (from >= to) {
			return { from: 0, to: 0 };
		}

		return { from, to };
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
					extension: MD,
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
				checked: event.checked,
				path: event.splitPath.pathParts,
				propertyName: event.propertyName,
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
	 * Cleanup: unsubscribe from vault and user events.
	 * Waits for any pending click operations to complete.
	 */
	async unsubscribe(): Promise<void> {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
		if (this.userEventTeardown) {
			this.userEventTeardown();
			this.userEventTeardown = null;
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

		const { sectionChain, deletedScrollSegmentId, pageNodeNames } = info;

		// Delete the old scroll from the tree (self-event filtering blocked the Delete event)
		// The scroll was in the parent section
		if (sectionChain.length > 1) {
			const parentChain = sectionChain.slice(0, -1);
			const parentSection = this.healer.findSection(parentChain);
			if (parentSection) {
				delete parentSection.children[deletedScrollSegmentId];
			}
		}

		// Ensure the section chain exists in the tree
		// (self-event filtering blocked the normal Create events)
		const section = this.healer.ensureSectionChain(sectionChain);

		// Populate section with page scroll nodes BEFORE codex generation
		// (self-event filtering will block the page Create events, so we add them here)
		for (const pageName of pageNodeNames) {
			const scrollSegId = this.codecs.segmentId.serializeSegmentId({
				coreName: pageName,
				extension: MD,
				targetKind: TreeNodeKind.Scroll,
			}) as ScrollNodeSegmentId;

			section.children[scrollSegId] = {
				extension: MD,
				kind: TreeNodeKind.Scroll,
				nodeName: pageName,
				status: TreeNodeStatus.NotStarted,
			};
		}

		// Build impacted chains: the new section + its parent (for codex content update)
		const chainKey = sectionChain.join("/");
		const impactedChains = new Set([chainKey]);

		// Parent section also needs codex regeneration (its children changed)
		if (sectionChain.length > 1) {
			const parentChain = sectionChain.slice(0, -1);
			impactedChains.add(parentChain.join("/"));
		}

		// Create synthetic CodexImpact for the impacted sections
		const codexImpact: CodexImpact = {
			contentChanged: [],
			deleted: [],
			descendantsChanged: [],
			impactedChains,
			renamed: [],
		};

		// Process codex impact to generate vault actions
		const { codexRecreations } = processCodexImpacts(
			[codexImpact],
			this.healer,
			this.codecs,
		);

		// Assemble and dispatch vault actions
		const vaultActions = assembleVaultActions(
			[],
			codexRecreations,
			this.rules,
			this.codecs,
		);

		if (vaultActions.length > 0) {
			logger.debug(
				"[Librarian.triggerSectionHealing] Dispatching codex actions:",
				JSON.stringify({ actionCount: vaultActions.length, chainKey }),
			);
			await this.vaultActionManager.dispatch(vaultActions);
		}
	}
}
