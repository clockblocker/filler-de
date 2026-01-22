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
export async function handleActionClick(
	deps: ClickDispatcherDeps,
	actionId: string,
): Promise<void> {
	const services = deps.getServices();
	const context = deps.getCurrentContext();

	if (!services || !context) {
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
	await executeAction(action, {
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
	// Use mousedown instead of click because buttons may be re-rendered
	// between mousedown and mouseup (e.g., after navigation), which prevents
	// the click event from firing. mousedown always fires before any re-render.
	const handler = (evt: MouseEvent) => {
		// Only handle left mouse button
		if (evt.button !== 0) return;

		const target = evt.target as HTMLElement;
		const button = target.closest("[data-action]") as HTMLElement | null;
		if (!button) return;

		// Skip disabled buttons
		if (button.hasAttribute("disabled")) return;

		const actionId = button.dataset.action;
		if (!actionId) return;

		void handleActionClick(deps, actionId);
	};

	document.addEventListener("mousedown", handler, true); // capture: true
	plugin.register(() =>
		document.removeEventListener("mousedown", handler, true),
	);
}
