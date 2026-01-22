import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import type { ApiService } from "../../atomic-services/api-service";
import type { SelectionService } from "../../atomic-services/selection-service";
import type { BottomToolbarService } from "../../button-manager/bottom-toolbar";
import type { NavigationLayoutCoordinator } from "../../button-manager/navigation-layout-coordinator";
import type { AboveSelectionToolbarService } from "../../button-manager/selection-toolbar";
import {
	ActionPlacement,
	type CommanderAction,
	type CommanderActionProvider,
	type OverlayContext,
} from "../types";

/**
 * Services required by OverlayManager (re-exported for use by other modules).
 */
export type OverlayManagerServices = {
	apiService: ApiService;
	selectionService: SelectionService;
	vaultActionManager: VaultActionManager;
};

/**
 * Toolbar services for rendering.
 */
export type ToolbarServices = {
	bottom: BottomToolbarService;
	selection: AboveSelectionToolbarService;
	layoutCoordinator: NavigationLayoutCoordinator;
};

/**
 * Convert CommanderActions to RenderedActionConfig for toolbar services.
 * This bridges the new type system with existing toolbar implementations.
 */
function toRenderedConfigs(actions: CommanderAction[]): Array<{
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
 * Query all registered providers for available actions.
 */
export function queryProviders(
	providers: CommanderActionProvider[],
	context: OverlayContext,
): CommanderAction[] {
	const allActions: CommanderAction[] = [];

	for (const provider of providers) {
		const actions = provider.getAvailableActions(context);
		allActions.push(...actions);
	}

	// Sort by provider priority (already sorted) then by action priority
	return allActions.sort((a, b) => a.priority - b.priority);
}

/**
 * Execute recompute: query providers and update toolbars.
 */
export function executeRecompute(
	context: OverlayContext,
	providers: CommanderActionProvider[],
	toolbars: ToolbarServices,
): void {
	// Query all providers for actions
	const allActions = queryProviders(providers, context);

	// Filter by placement
	const bottomActions = allActions.filter(
		(a) => a.placement === ActionPlacement.Bottom,
	);
	const selectionActions = allActions.filter(
		(a) => a.placement === ActionPlacement.Selection,
	);

	// Convert to rendered configs for toolbar services
	const bottomConfigs = toRenderedConfigs(bottomActions);
	const selectionConfigs = toRenderedConfigs(selectionActions);

	// Update toolbar services
	// biome-ignore lint/suspicious/noExplicitAny: <bridging type systems>
	toolbars.bottom.setActions(bottomConfigs as any);
	// biome-ignore lint/suspicious/noExplicitAny: <bridging type systems>
	toolbars.layoutCoordinator.setActions(bottomConfigs as any);
	// biome-ignore lint/suspicious/noExplicitAny: <bridging type systems>
	toolbars.selection.setActions(selectionConfigs as any);
}
