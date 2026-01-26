/**
 * OverlayManager - manages UI overlays like the bottom toolbar and selection toolbar.
 *
 * Subscribes to workspace events and maintains a toolbar on EVERY open markdown pane.
 * Toolbars persist when switching between panes and are only destroyed when their
 * leaf closes. Each toolbar tracks its own file path context.
 *
 * The selection toolbar appears above text selections with actions configured for "selection" placement.
 * The bottom toolbar shows actions configured for "bottom" placement.
 *
 * See about.md for responsibility boundary documentation.
 */

import { type App, MarkdownView } from "obsidian";
import { ActionKind } from "../../deprecated-services/obsidian-services/deprecated-overlay-manager/types";
import { getParsedUserSettings } from "../../global-state/global-state";
import type { SelectionActionPlacement } from "../../types";
import { logger } from "../../utils/logger";
import type { CommandExecutor } from "../actions-manager/create-action-executor";
import {
	type ActionElementClickedPayload,
	HandlerOutcome,
	PayloadKind,
	type SelectionChangedPayload,
	type UserEventInterceptor,
} from "../obsidian/user-event-interceptor";
import type { SplitPathToMdFile } from "../obsidian/vault-action-manager/types/split-path";
import type {
	Teardown,
	WorkspaceEvent,
} from "../obsidian/workspace-navigation-event-interceptor";
import {
	WorkspaceEventInterceptor,
	WorkspaceEventKind,
} from "../obsidian/workspace-navigation-event-interceptor";
import {
	type ActionConfig,
	type BottomToolbar,
	createBottomToolbar,
} from "./bottom-toolbar";
import {
	createSelectionToolbar,
	type SelectionToolbar,
} from "./selection-toolbar";

/**
 * Action definitions with their display labels and setting keys.
 */
const ACTION_DEFINITIONS = [
	{ id: "Translate", label: "Translate", settingKey: "translatePlacement" },
	{
		id: "SplitInBlocks",
		label: "Split in Blocks",
		settingKey: "splitInBlocksPlacement",
	},
	{
		id: "ExplainGrammar",
		label: "Explain Grammar",
		settingKey: "explainGrammarPlacement",
	},
	{ id: "Generate", label: "Generate", settingKey: "generatePlacement" },
] as const;

/** Known action IDs that this manager handles */
const KNOWN_ACTION_IDS = new Set(ACTION_DEFINITIONS.map((d) => d.id));

/**
 * Computed actions for each toolbar placement.
 */
type ComputedActions = {
	selectionActions: ActionConfig[];
	bottomActions: ActionConfig[];
};

/**
 * Dependencies for OverlayManager.
 */
export type OverlayManagerDeps = {
	/** Obsidian app instance */
	app: App;
	/** User event interceptor for selection events */
	userEventInterceptor?: UserEventInterceptor;
	/** Command executor for handling action clicks */
	commandExecutor?: CommandExecutor;
};

/**
 * OverlayManager - orchestrates UI overlays based on workspace events.
 */
export class OverlayManager {
	private readonly app: App;
	private readonly workspaceInterceptor: WorkspaceEventInterceptor;
	private readonly userEventInterceptor: UserEventInterceptor | null;
	private readonly commandExecutor: CommandExecutor | null;
	private workspaceTeardown: Teardown | null = null;
	private selectionHandlerTeardown: (() => void) | null = null;
	private actionClickHandlerTeardown: (() => void) | null = null;
	/** Bottom toolbars per leaf, keyed by leaf ID */
	private bottomToolbars = new Map<string, BottomToolbar>();
	/** Selection toolbars per leaf, keyed by leaf ID */
	private selectionToolbars = new Map<string, SelectionToolbar>();
	/** Scroll handler bound to this instance */
	private boundScrollHandler: (() => void) | null = null;
	/** Current active leaf ID */
	private activeLeafId: string | null = null;

	constructor(deps: OverlayManagerDeps) {
		this.app = deps.app;
		this.workspaceInterceptor = new WorkspaceEventInterceptor(this.app);
		this.userEventInterceptor = deps.userEventInterceptor ?? null;
		this.commandExecutor = deps.commandExecutor ?? null;
	}

	/**
	 * Initialize and start listening to workspace events.
	 */
	init(): void {
		this.workspaceInterceptor.startListening();
		this.workspaceTeardown = this.workspaceInterceptor.subscribe(
			this.handleWorkspaceEvent.bind(this),
		);

		// Subscribe to selection changed events
		if (this.userEventInterceptor) {
			this.selectionHandlerTeardown =
				this.userEventInterceptor.setHandler(
					PayloadKind.SelectionChanged,
					{
						doesApply: () => true,
						handle: async (payload: SelectionChangedPayload) => {
							this.handleSelectionChanged(payload);
							return { outcome: HandlerOutcome.Passthrough };
						},
					},
				);

			// Subscribe to action element clicked events
			this.actionClickHandlerTeardown =
				this.userEventInterceptor.setHandler(
					PayloadKind.ActionElementClicked,
					{
						doesApply: (payload: ActionElementClickedPayload) =>
							KNOWN_ACTION_IDS.has(payload.actionId),
						handle: async (
							payload: ActionElementClickedPayload,
						) => {
							await this.handleActionClick(payload.actionId);
							return { outcome: HandlerOutcome.Handled };
						},
					},
				);
		}

		// Set up scroll listener
		this.boundScrollHandler = this.handleScroll.bind(this);
		window.addEventListener("scroll", this.boundScrollHandler, true);

		// Check current state on init
		this.updateToolbarVisibility();
	}

	/**
	 * Get the current file path from the active leaf's toolbar.
	 */
	getCurrentFilePath(): SplitPathToMdFile | null {
		const activeLeaf = this.app.workspace.activeLeaf;
		// Obsidian leaf.id is not in public API, accessing via any
		const leafId = (activeLeaf as any)?.id as string | undefined;
		if (!leafId) return null;
		return this.bottomToolbars.get(leafId)?.getCurrentFilePath() ?? null;
	}

	/**
	 * Clean up and stop listening.
	 */
	destroy(): void {
		if (this.workspaceTeardown) {
			this.workspaceTeardown();
			this.workspaceTeardown = null;
		}

		if (this.selectionHandlerTeardown) {
			this.selectionHandlerTeardown();
			this.selectionHandlerTeardown = null;
		}

		if (this.actionClickHandlerTeardown) {
			this.actionClickHandlerTeardown();
			this.actionClickHandlerTeardown = null;
		}

		if (this.boundScrollHandler) {
			window.removeEventListener("scroll", this.boundScrollHandler, true);
			this.boundScrollHandler = null;
		}

		this.workspaceInterceptor.stopListening();

		for (const toolbar of this.bottomToolbars.values()) {
			toolbar.destroy();
		}
		this.bottomToolbars.clear();

		for (const toolbar of this.selectionToolbars.values()) {
			toolbar.destroy();
		}
		this.selectionToolbars.clear();
	}

	// ─── Private ───

	/**
	 * Handle action button click by routing to commandExecutor.
	 */
	private async handleActionClick(actionId: string): Promise<void> {
		if (!this.commandExecutor) {
			logger.warn("[OverlayManager] No commandExecutor provided");
			return;
		}

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const selection = view?.editor?.getSelection() ?? "";

		switch (actionId) {
			case "Translate":
				if (selection) {
					await this.commandExecutor({
						kind: ActionKind.TranslateSelection,
						payload: { selection },
					});
				}
				break;

			case "SplitInBlocks":
				if (selection) {
					await this.commandExecutor({
						kind: ActionKind.SplitInBlocks,
						payload: { fileContent: "", selection },
					});
				}
				break;

			case "ExplainGrammar":
				if (selection) {
					await this.commandExecutor({
						kind: ActionKind.ExplainGrammar,
						payload: { selection },
					});
				}
				break;

			case "Generate":
				await this.commandExecutor({
					kind: ActionKind.Generate,
					payload: {},
				});
				break;

			default:
				logger.warn(
					`[OverlayManager] Unknown action: ${JSON.stringify({ actionId })}`,
				);
		}
	}

	/**
	 * Compute which actions go to which toolbar based on settings.
	 */
	private computeAllowedActions(): ComputedActions {
		const settings = getParsedUserSettings();
		const selectionActions: ActionConfig[] = [];
		const bottomActions: ActionConfig[] = [];

		for (const def of ACTION_DEFINITIONS) {
			const placement = settings[
				def.settingKey as keyof typeof settings
			] as SelectionActionPlacement;

			if (placement === "selection") {
				selectionActions.push({ id: def.id, label: def.label });
			} else if (placement === "bottom") {
				bottomActions.push({ id: def.id, label: def.label });
			}
			// "shortcut-only" actions go to neither toolbar
		}

		return { bottomActions, selectionActions };
	}

	private handleWorkspaceEvent(event: WorkspaceEvent): void {
		switch (event.kind) {
			case WorkspaceEventKind.FileOpen:
			case WorkspaceEventKind.LayoutChange:
				this.updateToolbarVisibility();
				break;
			case WorkspaceEventKind.LayoutReady:
			case WorkspaceEventKind.Resize:
				// No action needed
				break;
		}
	}

	private updateToolbarVisibility(): void {
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		const activeLeafIds = new Set<string>();
		const { bottomActions, selectionActions } =
			this.computeAllowedActions();

		for (const leaf of leaves) {
			const file = leaf.view?.file;
			if (!file || file.extension !== "md") continue;

			// Obsidian leaf.id is not in public API, accessing via any
			const leafId = (leaf as any).id as string | undefined;
			if (!leafId) continue;
			activeLeafIds.add(leafId);

			const container =
				leaf.view.containerEl?.querySelector(".view-content");
			if (!container || !(container instanceof HTMLElement)) continue;

			// Create bottom toolbar if not exists for this leaf
			if (!this.bottomToolbars.has(leafId)) {
				const toolbar = createBottomToolbar({ container });
				toolbar.setActions(bottomActions);
				this.bottomToolbars.set(leafId, toolbar);
			} else {
				// Update actions for existing toolbar
				this.bottomToolbars.get(leafId)?.setActions(bottomActions);
			}

			// Create selection toolbar if not exists for this leaf
			if (!this.selectionToolbars.has(leafId)) {
				const toolbar = createSelectionToolbar({ container });
				toolbar.setActions(selectionActions);
				this.selectionToolbars.set(leafId, toolbar);
			} else {
				// Update actions for existing toolbar
				this.selectionToolbars
					.get(leafId)
					?.setActions(selectionActions);
			}

			const filePath = this.buildSplitPath(file.path);
			if (filePath) {
				this.bottomToolbars.get(leafId)?.show(filePath);
			}
		}

		// Remove toolbars for closed leaves
		for (const [leafId, toolbar] of this.bottomToolbars) {
			if (!activeLeafIds.has(leafId)) {
				toolbar.destroy();
				this.bottomToolbars.delete(leafId);
			}
		}

		for (const [leafId, toolbar] of this.selectionToolbars) {
			if (!activeLeafIds.has(leafId)) {
				toolbar.destroy();
				this.selectionToolbars.delete(leafId);
			}
		}
	}

	private buildSplitPath(path: string): SplitPathToMdFile | null {
		// Split path into segments
		const parts = path.split("/");
		const basename = parts.pop();

		if (!basename || !basename.endsWith(".md")) {
			return null;
		}

		// Remove .md extension for basename
		const basenameWithoutExt = basename.slice(0, -3);

		return {
			basename: basenameWithoutExt,
			extension: "md",
			segments: parts,
		};
	}

	private handleSelectionChanged(payload: SelectionChangedPayload): void {
		// Get active leaf ID
		const activeLeaf = this.app.workspace.activeLeaf;
		// Obsidian leaf.id is not in public API, accessing via any
		const activeLeafId = (activeLeaf as any)?.id as string | undefined;
		this.activeLeafId = activeLeafId ?? null;

		// Update ALL bottom toolbars: show button only on active leaf if there's a selection
		for (const [leafId, toolbar] of this.bottomToolbars) {
			const showButton = payload.hasSelection && leafId === activeLeafId;
			toolbar.updateSelectionContext(showButton);
		}

		// Handle selection toolbar
		if (payload.hasSelection && activeLeafId) {
			const selectionToolbar = this.selectionToolbars.get(activeLeafId);
			if (selectionToolbar) {
				// Get selection rect from window.getSelection()
				const selection = window.getSelection();
				if (selection && selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const rect = range.getBoundingClientRect();
					selectionToolbar.show(rect);
				}
			}

			// Hide selection toolbars for other leaves
			for (const [leafId, toolbar] of this.selectionToolbars) {
				if (leafId !== activeLeafId) {
					toolbar.hide();
				}
			}
		} else {
			// No selection - hide all selection toolbars
			for (const toolbar of this.selectionToolbars.values()) {
				toolbar.hide();
			}
		}
	}

	private handleScroll(): void {
		// Hide selection toolbar on scroll
		if (this.activeLeafId) {
			const selectionToolbar = this.selectionToolbars.get(
				this.activeLeafId,
			);
			if (selectionToolbar) {
				selectionToolbar.hide();
			}
		}
	}
}
