/**
 * OverlayManager - thin orchestrator for UI overlays.
 *
 * Subscribes to workspace and user events, delegates to extracted modules:
 * - action-definitions: action types and placement computation
 * - action-click-dispatcher: routing action clicks to commands
 * - selection-handler: managing selection toolbar visibility
 * - toolbar-lifecycle: creating/updating/destroying toolbars
 *
 * See about.md for responsibility boundary documentation.
 */

import type { App, Plugin } from "obsidian";
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
import { dispatchActionClick } from "./action-click-dispatcher";
import { computeAllowedActions, KNOWN_ACTION_IDS } from "./action-definitions";
import { type BottomToolbar, createBottomToolbar } from "./bottom-toolbar";
import { setupContextMenu } from "./context-menu";
import { createEdgeZones, type EdgeZones } from "./edge-zones";
import { handleSelectionChanged } from "./selection-handler";
import {
	createSelectionToolbar,
	type SelectionToolbar,
} from "./selection-toolbar";
import { updateToolbarVisibility } from "./toolbar-lifecycle";

/**
 * Dependencies for OverlayManager.
 */
export type OverlayManagerDeps = {
	app: App;
	plugin?: Plugin;
	userEventInterceptor?: UserEventInterceptor;
	commandExecutor?: CommandExecutor;
};

/**
 * OverlayManager - orchestrates UI overlays based on workspace events.
 */
export class OverlayManager {
	private readonly app: App;
	private readonly plugin: Plugin | null;
	private readonly workspaceInterceptor: WorkspaceEventInterceptor;
	private readonly userEventInterceptor: UserEventInterceptor | null;
	private readonly commandExecutor: CommandExecutor | null;
	private workspaceTeardown: Teardown | null = null;
	private selectionHandlerTeardown: (() => void) | null = null;
	private actionClickHandlerTeardown: (() => void) | null = null;
	private contextMenuTeardown: (() => void) | null = null;
	private bottomToolbars = new Map<string, BottomToolbar>();
	private selectionToolbars = new Map<string, SelectionToolbar>();
	private edgeZones = new Map<string, EdgeZones>();
	private activeLeafId: string | null = null;

	constructor(deps: OverlayManagerDeps) {
		this.app = deps.app;
		this.plugin = deps.plugin ?? null;
		this.workspaceInterceptor = new WorkspaceEventInterceptor(this.app);
		this.userEventInterceptor = deps.userEventInterceptor ?? null;
		this.commandExecutor = deps.commandExecutor ?? null;
	}

	init(): void {
		this.workspaceInterceptor.startListening();
		this.workspaceTeardown = this.workspaceInterceptor.subscribe(
			this.handleWorkspaceEvent.bind(this),
		);

		if (this.userEventInterceptor) {
			this.selectionHandlerTeardown =
				this.userEventInterceptor.setHandler(
					PayloadKind.SelectionChanged,
					{
						doesApply: () => true,
						handle: async (payload: SelectionChangedPayload) => {
							const result = handleSelectionChanged(payload, {
								activeLeafId: this.activeLeafId,
								app: this.app,
								bottomToolbars: this.bottomToolbars,
								selectionToolbars: this.selectionToolbars,
							});
							this.activeLeafId = result.newActiveLeafId;
							return { outcome: HandlerOutcome.Passthrough };
						},
					},
				);

			this.actionClickHandlerTeardown =
				this.userEventInterceptor.setHandler(
					PayloadKind.ActionElementClicked,
					{
						doesApply: (payload: ActionElementClickedPayload) =>
							KNOWN_ACTION_IDS.has(payload.actionId),
						handle: async (
							payload: ActionElementClickedPayload,
						) => {
							await dispatchActionClick(payload.actionId, {
								app: this.app,
								commandExecutor: this.commandExecutor,
								getCurrentFilePath: () =>
									this.getCurrentFilePath(),
							});
							return { outcome: HandlerOutcome.Handled };
						},
					},
				);
		}

		// Setup context menu for "Split into pages"
		if (this.plugin) {
			this.contextMenuTeardown = setupContextMenu({
				app: this.app,
				commandExecutor: this.commandExecutor,
				plugin: this.plugin,
			});
		}

		this.refreshToolbars();
	}

	getCurrentFilePath(): SplitPathToMdFile | null {
		const activeLeaf = this.app.workspace.activeLeaf;
		// Obsidian leaf.id is not in public API
		const leafId = (activeLeaf as any)?.id as string | undefined;
		if (!leafId) return null;
		return this.bottomToolbars.get(leafId)?.getCurrentFilePath() ?? null;
	}

	destroy(): void {
		this.workspaceTeardown?.();
		this.workspaceTeardown = null;
		this.selectionHandlerTeardown?.();
		this.selectionHandlerTeardown = null;
		this.actionClickHandlerTeardown?.();
		this.actionClickHandlerTeardown = null;
		this.contextMenuTeardown?.();
		this.contextMenuTeardown = null;

		this.workspaceInterceptor.stopListening();

		for (const toolbar of this.bottomToolbars.values()) toolbar.destroy();
		this.bottomToolbars.clear();

		for (const toolbar of this.selectionToolbars.values())
			toolbar.destroy();
		this.selectionToolbars.clear();

		for (const zones of this.edgeZones.values()) zones.destroy();
		this.edgeZones.clear();
	}

	// ─── Private ───

	private handleWorkspaceEvent(event: WorkspaceEvent): void {
		switch (event.kind) {
			case WorkspaceEventKind.FileOpen:
			case WorkspaceEventKind.LayoutChange:
				this.refreshToolbars();
				break;
			case WorkspaceEventKind.Scroll:
				this.hideSelectionToolbar();
				break;
			case WorkspaceEventKind.LayoutReady:
			case WorkspaceEventKind.Resize:
				break;
		}
	}

	refreshToolbars(): void {
		const actions = computeAllowedActions();
		updateToolbarVisibility(
			{
				app: this.app,
				bottomToolbars: this.bottomToolbars,
				createBottomToolbar: (container) =>
					createBottomToolbar({ container }),
				createEdgeZones: (container) => createEdgeZones({ container }),
				createSelectionToolbar: (container) =>
					createSelectionToolbar({ container }),
				edgeZones: this.edgeZones,
				selectionToolbars: this.selectionToolbars,
			},
			actions,
		);
	}

	private hideSelectionToolbar(): void {
		if (this.activeLeafId) {
			this.selectionToolbars.get(this.activeLeafId)?.hide();
		}
	}
}
