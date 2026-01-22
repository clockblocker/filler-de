import type { App, Plugin } from "obsidian";
import { logger } from "../../../../utils/logger";
import type { TexfresserObsidianServices } from "../../interface";
import { type OverlayManagerServices, queryProviders } from "../coordination";
import { executeAction } from "../executor-registry";
import type { CommanderActionProvider, OverlayContext } from "../types";

/**
 * Dependencies for ActionClickDispatcher.
 */
export type ClickDispatcherDeps = {
	app: App;
	getProviders: () => CommanderActionProvider[];
	getServices: () => OverlayManagerServices | null;
	getCurrentContext: () => OverlayContext | null;
};

/**
 * Handle action click by ID.
 */
export function handleActionClick(
	deps: ClickDispatcherDeps,
	actionId: string,
): void {
	const services = deps.getServices();
	const context = deps.getCurrentContext();

	if (!services || !context) {
		logger.warn(
			`[OverlayManager] handleActionClick early return: services=${!!services}, context=${!!context}`,
		);
		return;
	}

	// Find the action by ID
	const allActions = queryProviders(deps.getProviders(), context);
	const action = allActions.find((a) => a.id === actionId);

	if (!action) {
		logger.warn(
			`[OverlayManager] Action not found: ${actionId}. Available: ${allActions.map((a) => a.id).join(", ")}`,
		);
		return;
	}

	// Execute the action
	executeAction(action, {
		apiService: services.apiService,
		app: deps.app,
		selectionService: services.selectionService,
		vaultActionManager: services.vaultActionManager,
	} as Partial<TexfresserObsidianServices>);
}

/**
 * Setup delegated click handler for action buttons (edge zones, etc).
 */
export function setupDelegatedClickHandler(
	plugin: Plugin,
	deps: ClickDispatcherDeps,
): void {
	plugin.registerDomEvent(document, "click", (evt: MouseEvent) => {
		const target = evt.target as HTMLElement;
		const button = target.closest("[data-action]") as HTMLElement | null;
		if (!button) return;

		const actionId = button.dataset.action;
		if (!actionId) return;

		handleActionClick(deps, actionId);
	});
}
