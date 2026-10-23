/**
 * OverlayManager - thin orchestrator for UI overlays.
 *
 * Subscribes to user events, and is told the workspace events its Layer
 * listens to (`OverlayLive`, through `PluginHost`); it delegates to
 * extracted modules:
 * - action-definitions: action types and placement computation
 * - action-click-dispatcher: routing action clicks to commands
 * - selection-handler: managing selection toolbar visibility
 * - toolbar-lifecycle: creating/updating/destroying toolbars
 *
 * See about.md for responsibility boundary documentation.
 */

import {
	type ObsidianEventLayer,
	type PayloadFor,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { App, Menu } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import type { ReadSync } from "../../runtime/plugin-runtime";
import type { ParsedUserSettings } from "../../settings/parsed-settings";
import type { CommandExecutor } from "../obsidian/command-executor";
import { dispatchActionClick } from "./action-click-dispatcher/dispatcher";
import { KNOWN_ACTION_IDS } from "./action-definitions/definitions";
import { computeAllowedActions } from "./action-definitions/placement-utils";
import { isOverlayActionKind } from "./action-definitions/types";
import { createBottomToolbar } from "./bottom-toolbar/bottom-toolbar";
import type { BottomToolbar } from "./bottom-toolbar/types";
import { contextMenuHandler } from "./context-menu/context-menu";
import { createEdgeZones } from "./edge-zones/edge-zones";
import type { EdgeZones } from "./edge-zones/types";
import { handleSelectionChanged } from "./selection-handler/handler";
import { createSelectionToolbar } from "./selection-toolbar/selection-toolbar";
import type { SelectionToolbar } from "./selection-toolbar/types";
import { updateToolbarVisibility } from "./toolbar-lifecycle/manager";

/**
 * Dependencies for OverlayManager.
 */
type OverlayManagerDeps = {
	app: App;
	/**
	 * The current Librarian. A getter, because the plugin replaces the
	 * Librarian when settings such as the Library root change.
	 */
	getLibrarian: () => Librarian | null;
	userEventInterceptor?: ObsidianEventLayer;
	commandExecutor?: CommandExecutor;
	/** Reads the active note synchronously as the context menu opens. */
	readSync: ReadSync;
	/** The settings in effect, read as a toolbar or the context menu is drawn. */
	settings: () => ParsedUserSettings;
	vam: VaultActionManager;
};

/**
 * OverlayManager - orchestrates UI overlays based on workspace events.
 */
export class OverlayManager {
	private readonly app: App;
	private readonly getLibrarian: () => Librarian | null;
	private readonly userEventInterceptor: ObsidianEventLayer | null;
	private readonly commandExecutor: CommandExecutor | null;
	private readonly vam: VaultActionManager;
	private readonly readSync: ReadSync;
	private readonly settings: () => ParsedUserSettings;
	private selectionHandlerTeardown: (() => void) | null = null;
	private actionClickHandlerTeardown: (() => void) | null = null;
	private bottomToolbars = new Map<string, BottomToolbar>();
	private selectionToolbars = new Map<string, SelectionToolbar>();
	private edgeZones = new Map<string, EdgeZones>();
	private activeLeafId: string | null = null;

	constructor(deps: OverlayManagerDeps) {
		this.app = deps.app;
		this.getLibrarian = deps.getLibrarian;
		this.userEventInterceptor = deps.userEventInterceptor ?? null;
		this.commandExecutor = deps.commandExecutor ?? null;
		this.vam = deps.vam;
		this.readSync = deps.readSync;
		this.settings = deps.settings;
	}

	init(): void {
		if (this.userEventInterceptor) {
			// Rendering only, and frequent: the layer runs it untraced.
			this.selectionHandlerTeardown =
				this.userEventInterceptor.setHandler(
					UserEventKind.SelectionChanged,
					{
						doesApply: () => true,
						handle: (payload: PayloadFor<"SelectionChanged">) =>
							Effect.sync(() => {
								const result = handleSelectionChanged(payload, {
									activeLeafId: this.activeLeafId,
									app: this.app,
									bottomToolbars: this.bottomToolbars,
									selectionToolbars: this.selectionToolbars,
								});
								this.activeLeafId = result.newActiveLeafId;
								return { outcome: "passthrough" } as const;
							}),
					},
				);

			// The button's command runs under its own `command.<kind>`.
			this.actionClickHandlerTeardown =
				this.userEventInterceptor.setHandler(
					UserEventKind.ActionElementClicked,
					{
						doesApply: (
							payload: PayloadFor<"ActionElementClicked">,
						) => KNOWN_ACTION_IDS.has(payload.actionId),
						handle: (
							payload: PayloadFor<"ActionElementClicked">,
						) => {
							const { commandExecutor } = this;
							const dispatched =
								commandExecutor &&
								isOverlayActionKind(payload.actionId)
									? dispatchActionClick(payload.actionId, {
											commandExecutor,
										})
									: Effect.void;
							return Effect.as(dispatched, {
								outcome: "handled",
							} as const);
						},
					},
				);
		}

		this.refreshToolbars();
	}

	/** Adds the editor menu's "Split into pages" item, as the menu opens. */
	readonly onEditorMenu: (menu: Menu) => void = (menu) => {
		const { getLibrarian } = this;
		contextMenuHandler({
			commandExecutor: this.commandExecutor,
			librarian: {
				get codecRules() {
					return getLibrarian()?.codecRules ?? null;
				},
				isInsideLibrary: (splitPath) =>
					getLibrarian()?.isInsideLibrary(splitPath) ?? false,
			},
			readSync: this.readSync,
			settings: this.settings,
			vam: this.vam,
		})(menu);
	};

	destroy(): void {
		this.selectionHandlerTeardown?.();
		this.selectionHandlerTeardown = null;
		this.actionClickHandlerTeardown?.();
		this.actionClickHandlerTeardown = null;

		for (const toolbar of this.bottomToolbars.values()) toolbar.destroy();
		this.bottomToolbars.clear();

		for (const toolbar of this.selectionToolbars.values())
			toolbar.destroy();
		this.selectionToolbars.clear();

		for (const zones of this.edgeZones.values()) zones.destroy();
		this.edgeZones.clear();
	}

	/** Places the toolbars anew: a file opened, or the layout changed. */
	refreshToolbars(): void {
		const librarian = this.getLibrarian();
		if (!librarian) return;
		const actions = computeAllowedActions(this.settings());
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
				librarian,
				selectionToolbars: this.selectionToolbars,
			},
			actions,
		);
	}

	/** A pane scrolled: the selection toolbar no longer sits by its selection. */
	hideSelectionToolbar(): void {
		if (this.activeLeafId) {
			this.selectionToolbars.get(this.activeLeafId)?.hide();
		}
	}
}
