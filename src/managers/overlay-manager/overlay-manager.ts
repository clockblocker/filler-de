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

import type { App } from "obsidian";
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
	userEventInterceptor?: UserEventInterceptor;
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
	private bottomToolbars = new Map<string, BottomToolbar>();
	private selectionToolbars = new Map<string, SelectionToolbar>();
	private activeLeafId: string | null = null;

	constructor(deps: OverlayManagerDeps) {
		this.app = deps.app;
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
							});
							return { outcome: HandlerOutcome.Handled };
						},
					},
				);
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

		this.workspaceInterceptor.stopListening();

		for (const toolbar of this.bottomToolbars.values()) toolbar.destroy();
		this.bottomToolbars.clear();

		for (const toolbar of this.selectionToolbars.values())
			toolbar.destroy();
		this.selectionToolbars.clear();
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
				createSelectionToolbar: (container) =>
					createSelectionToolbar({ container }),
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
