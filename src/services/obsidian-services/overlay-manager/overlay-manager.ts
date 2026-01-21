import {
	type App,
	MarkdownView,
	type Plugin,
	type WorkspaceLeaf,
} from "obsidian";
import { z } from "zod";
import { getNextPageSplitPath } from "../../../commanders/librarian/bookkeeper/page-codec";
import { wouldSplitToMultiplePages as checkWouldSplit } from "../../../commanders/librarian/bookkeeper/segmenter";
import { makeCodecRulesFromSettings } from "../../../commanders/librarian/codecs/rules";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "../../../managers/obsidian/vault-action-manager";
import { readMetadata } from "../../../managers/pure/note-metadata-manager";
import {
	FileType,
	MdFileSubTypeSchema,
} from "../../../types/common-interface/enums";
import { logger } from "../../../utils/logger";
import type { ApiService } from "../atomic-services/api-service";
import type { SelectionService } from "../atomic-services/selection-service";
import { BottomToolbarService } from "../button-manager/bottom-toolbar";
import { EdgePaddingNavigator } from "../button-manager/edge-padding-navigator";
import { NavigationLayoutCoordinator } from "../button-manager/navigation-layout-coordinator";
import { AboveSelectionToolbarService } from "../button-manager/selection-toolbar";
import { executeAction } from "./executor-registry";
import {
	ActionPlacement,
	type CommanderAction,
	type CommanderActionProvider,
	type OverlayContext,
} from "./types";

// Schema for reading noteKind from metadata
const FileTypeMetadataSchema = z.object({
	noteKind: MdFileSubTypeSchema.optional(),
});

export type OverlayManagerServices = {
	apiService: ApiService;
	selectionService: SelectionService;
	vaultActionManager: VaultActionManager;
};

/**
 * OverlayManager - unified facade for all overlay UI.
 * Replaces ButtonManager with commander-based action system.
 *
 * Responsibilities:
 * - Subscribe to user behaviors (selection, navigation, resize)
 * - Query registered CommanderActionProviders for available actions
 * - Render appropriate UI (bottom bar, selection toolbar, edge zones)
 * - Handle clicks → dispatch to ActionExecutorRegistry
 */
export class OverlayManager {
	private static readonly DEBOUNCE_MS = 50;

	// Toolbar services (reused from existing implementation)
	private bottom: BottomToolbarService;
	private selection: AboveSelectionToolbarService;
	private edgePaddingNavigator: EdgePaddingNavigator;
	private layoutCoordinator: NavigationLayoutCoordinator;

	// Commander providers
	private providers: CommanderActionProvider[] = [];

	// State
	private services: OverlayManagerServices | null = null;
	private currentContext: OverlayContext | null = null;
	private recomputeTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private app: App,
		private plugin: Plugin,
	) {
		this.bottom = new BottomToolbarService(this.app);
		this.selection = new AboveSelectionToolbarService(this.app);
		this.edgePaddingNavigator = new EdgePaddingNavigator();
		this.layoutCoordinator = new NavigationLayoutCoordinator(
			this.edgePaddingNavigator,
			this.bottom,
		);
	}

	/**
	 * Register a commander action provider.
	 * Providers are sorted by priority (lower = higher priority).
	 */
	public registerProvider(provider: CommanderActionProvider): void {
		this.providers.push(provider);
		this.providers.sort((a, b) => a.priority - b.priority);
	}

	/**
	 * Initialize with services and wire up all event subscriptions.
	 */
	public init(services: OverlayManagerServices): void {
		this.services = services;

		// Set direct click handler for bottom toolbar buttons BEFORE init
		// (init calls renderButtons which needs the handler to attach listeners)
		this.bottom.setClickHandler((actionId) => {
			this.handleActionClick(actionId);
		});

		// Initialize bottom toolbar
		this.bottom.init();

		// Setup delegated click handler (for edge zones and other elements)
		this.setupClickHandler();

		// Initial recompute on layout ready
		this.app.workspace.onLayoutReady(async () => {
			await this.recompute();
			this.reattachUI();
		});

		// Reattach when user switches panes/notes
		this.plugin.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				(_leaf: WorkspaceLeaf) => {
					this.scheduleRecompute();
					this.reattachUI();
				},
			),
		);

		// Show selection toolbar after drag
		this.plugin.registerDomEvent(document, "dragend", async () => {
			await this.recompute();
		});

		// Show selection toolbar after mouse selection
		// Skip recompute if clicking on action buttons (prevents destroying button mid-click)
		this.plugin.registerDomEvent(document, "mouseup", async (evt) => {
			const target = evt.target as HTMLElement;
			if (target.closest("[data-action]")) {
				return; // Don't recompute when clicking action buttons
			}
			await this.recompute();
		});

		// Show selection toolbar after keyboard selection
		this.plugin.registerDomEvent(
			document,
			"keyup",
			async (evt: KeyboardEvent) => {
				const selectionKeys = [
					"ArrowLeft",
					"ArrowRight",
					"ArrowUp",
					"ArrowDown",
					"Shift",
					"Home",
					"End",
					"PageUp",
					"PageDown",
					"a",
				];

				if (evt.shiftKey || selectionKeys.includes(evt.key)) {
					await this.recompute();
				}
			},
		);

		// Re-check after major layout changes (splits, etc.)
		this.plugin.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.scheduleRecompute();
				this.reattachUI();
			}),
		);

		// Handle CSS changes - hide selection toolbar
		this.plugin.registerEvent(
			this.app.workspace.on("css-change", () => this.selection.hide()),
		);
	}

	/**
	 * Build OverlayContext from current app state.
	 */
	private async buildContext(): Promise<OverlayContext> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;

		let path: OverlayContext["path"] = null;
		let fileType: FileType | null = null;
		let isInLibrary = false;
		let wouldSplitToMultiplePages = false;
		let pageIndex: number | null = null;
		let hasNextPage = false;

		if (file) {
			const splitPath = makeSplitPath(file.path);
			path = splitPath;

			// Check if inside library
			try {
				const { splitPathToLibraryRoot } = getParsedUserSettings();
				const libraryPath = splitPathToLibraryRoot.pathParts.join("/");
				isInLibrary =
					file.path.startsWith(`${libraryPath}/`) ||
					file.path.startsWith(libraryPath);
			} catch {
				isInLibrary = false;
			}

			// Detect Page by filename pattern FIRST (before metadata read)
			const pageMatch =
				splitPath.kind === "MdFile"
					? splitPath.basename.match(/_Page_(\d{3})/)
					: null;

			if (pageMatch?.[1]) {
				fileType = FileType.Page;
				pageIndex = Number.parseInt(pageMatch[1], 10);

				// Check if next page exists
				const nextPath = getNextPageSplitPath(splitPath);
				if (nextPath) {
					const systemPath = makeSystemPathForSplitPath(nextPath);
					hasNextPage =
						this.app.vault.getAbstractFileByPath(systemPath) !==
						null;
				}
			} else if (isInLibrary) {
				// For non-page files, read metadata to determine type
				try {
					const content = await this.app.vault.read(file);
					const metaInfo = readMetadata(
						content,
						FileTypeMetadataSchema,
					);
					fileType = metaInfo?.noteKind ?? null;

					// Check if scroll would split to multiple pages
					if (fileType === FileType.Scroll) {
						const settings = getParsedUserSettings();
						const rules = makeCodecRulesFromSettings(settings);
						wouldSplitToMultiplePages = checkWouldSplit(
							content,
							splitPath.basename,
							rules,
						);
					}
				} catch {
					fileType = null;
				}
			}
		}

		// Check for text selection
		const hasSelection = this.hasActiveSelection(view);

		// Check mobile
		// biome-ignore lint/suspicious/noExplicitAny: <isMobile is not in official types but exists>
		const isMobile = (this.app as any).isMobile ?? false;

		// Check source mode
		const isSourceMode = view?.getMode() === "source";

		// Get viewport width
		const viewportWidth = window.innerWidth;

		return {
			fileType,
			hasNextPage,
			hasSelection,
			isInLibrary,
			isMobile,
			isSourceMode,
			pageIndex,
			path,
			viewportWidth,
			wouldSplitToMultiplePages,
		};
	}

	/**
	 * Check if there's an active text selection in the editor.
	 */
	private hasActiveSelection(view: MarkdownView | null): boolean {
		if (!view) return false;

		const editor = view.editor;
		if (!editor) return false;

		const selection = editor.getSelection();
		return selection.length > 0;
	}

	/**
	 * Query all registered providers for available actions.
	 */
	private queryProviders(context: OverlayContext): CommanderAction[] {
		const allActions: CommanderAction[] = [];

		for (const provider of this.providers) {
			const actions = provider.getAvailableActions(context);
			allActions.push(...actions);
		}

		// Sort by provider priority (already sorted) then by action priority
		return allActions.sort((a, b) => a.priority - b.priority);
	}

	/**
	 * Convert CommanderActions to RenderedActionConfig for toolbar services.
	 * This bridges the new type system with existing toolbar implementations.
	 */
	private toRenderedConfigs(actions: CommanderAction[]): Array<{
		id: string;
		label: string;
		priority: number;
		disabled: boolean;
		placement: string;
		isAvailable: () => boolean;
		execute: () => void;
	}> {
		return actions.map((action) => ({
			disabled: action.disabled ?? false,
			execute: () => {},
			id: action.id,
			isAvailable: () => true,
			label: action.label,
			placement: action.placement,
			priority: action.priority,
		}));
	}

	/**
	 * Recompute available actions and notify toolbar services.
	 */
	public async recompute(): Promise<void> {
		const ctx = await this.buildContext();
		this.currentContext = ctx;

		// Query all providers for actions
		const allActions = this.queryProviders(ctx);

		// Filter by placement
		const bottomActions = allActions.filter(
			(a) => a.placement === ActionPlacement.Bottom,
		);
		const selectionActions = allActions.filter(
			(a) => a.placement === ActionPlacement.Selection,
		);

		// Convert to rendered configs for toolbar services
		const bottomConfigs = this.toRenderedConfigs(bottomActions);
		const selectionConfigs = this.toRenderedConfigs(selectionActions);

		// Update toolbar services
		// biome-ignore lint/suspicious/noExplicitAny: <bridging type systems>
		this.bottom.setActions(bottomConfigs as any);
		// biome-ignore lint/suspicious/noExplicitAny: <bridging type systems>
		this.layoutCoordinator.setActions(bottomConfigs as any);
		// biome-ignore lint/suspicious/noExplicitAny: <bridging type systems>
		this.selection.setActions(selectionConfigs as any);
	}

	/**
	 * Schedule a debounced recompute.
	 */
	public scheduleRecompute(): void {
		if (this.recomputeTimeout) clearTimeout(this.recomputeTimeout);
		this.recomputeTimeout = setTimeout(() => {
			this.recomputeTimeout = null;
			void this.recompute();
		}, OverlayManager.DEBOUNCE_MS);
	}

	/**
	 * Reattach UI elements to current view.
	 */
	private reattachUI(): void {
		this.bottom.reattach();

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			this.layoutCoordinator.attach(view, this.bottom.isMobile());
		} else {
			this.layoutCoordinator.detach();
		}
	}

	/**
	 * Handle action click by ID - shared between direct and delegated handlers.
	 */
	private handleActionClick(actionId: string): void {
		logger.info(`[OverlayManager] handleActionClick called: ${actionId}`);
		if (!this.services || !this.currentContext) {
			logger.warn(
				`[OverlayManager] handleActionClick early return: services=${!!this.services}, context=${!!this.currentContext}`,
			);
			return;
		}

		// Find the action by ID
		const allActions = this.queryProviders(this.currentContext);
		const action = allActions.find((a) => a.id === actionId);

		if (!action) {
			logger.warn(
				`[OverlayManager] Action not found: ${actionId}. Available: ${allActions.map((a) => a.id).join(", ")}`,
			);
			return;
		}

		logger.info(
			`[OverlayManager] Executing action: ${actionId}, kind=${action.kind}`,
		);
		// Execute the action
		executeAction(action, {
			apiService: this.services.apiService,
			app: this.app,
			selectionService: this.services.selectionService,
			vaultActionManager: this.services.vaultActionManager,
		});
	}

	/**
	 * Setup delegated click handler for action buttons (edge zones, etc).
	 */
	private setupClickHandler(): void {
		this.plugin.registerDomEvent(document, "click", (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			const button = target.closest(
				"[data-action]",
			) as HTMLElement | null;
			if (!button) return;

			const actionId = button.dataset.action;
			if (!actionId) return;

			this.handleActionClick(actionId);
		});
	}

	/**
	 * Get current context (for external use).
	 */
	public getContext(): OverlayContext | null {
		return this.currentContext;
	}

	/**
	 * Cleanup - destroy all toolbar services.
	 */
	public destroy(): void {
		this.bottom.detach();
		this.selection.destroy();
		this.layoutCoordinator.detach();
	}
}
