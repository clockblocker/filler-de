import type { Plugin } from "obsidian";
import type { Librarian } from "../../../../commanders/librarian/librarian";
import {
	type CommandExecutor,
	createCommandExecutor,
} from "../../../../managers/actions-manager/create-action-executor";
import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import { DomSelectors } from "../../../../utils/dom-selectors";
import { logger } from "../../../../utils/logger";
import type { SelectionService } from "../../atomic-services/selection-service";
import { queryProviders } from "../coordination";
import {
	ActionKind,
	type ActionPayloads,
	type CommanderActionProvider,
	type OverlayContext,
} from "../types";

/**
 * Dependencies for ActionClickDispatcher.
 */
export type ClickDispatcherDeps = {
	getProviders: () => CommanderActionProvider[];
	getLibrarian: () => Librarian | null;
	getVaultActionManager: () => VaultActionManager;
	getSelectionService: () => SelectionService | null;
	getCurrentContext: () => OverlayContext | null;
};

/**
 * Build payload for action based on kind and context.
 */
function buildPayload<K extends ActionKind>(
	kind: K,
	context: OverlayContext,
	selectionService: SelectionService | null,
): ActionPayloads[K] | null {
	switch (kind) {
		case ActionKind.NavigatePage: {
			if (!context.path || context.path.kind !== SplitPathKind.MdFile) {
				return null;
			}
			// Direction comes from params, but we need currentFilePath from context
			// This will be merged with params in handleActionClick
			return {
				currentFilePath: context.path as SplitPathToMdFile,
				direction: "next", // placeholder, will be overwritten
			} as ActionPayloads[K];
		}

		case ActionKind.SplitInBlocks:
		case ActionKind.TranslateSelection:
		case ActionKind.ExplainGrammar:
		case ActionKind.Generate: {
			const selection = selectionService?.getSelection() ?? "";
			if (kind === ActionKind.SplitInBlocks) {
				return { fileContent: "", selection } as ActionPayloads[K];
			}
			return { selection } as ActionPayloads[K];
		}

		case ActionKind.MakeText:
		case ActionKind.SplitToPages:
			return {} as ActionPayloads[K];

		default: {
			return null;
		}
	}
}

/**
 * Handle action click by ID.
 */
export async function handleActionClick(
	deps: ClickDispatcherDeps,
	actionId: string,
): Promise<void> {
	const context = deps.getCurrentContext();
	if (!context) {
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

	// Create executor with injected managers
	const executor: CommandExecutor = createCommandExecutor({
		librarian: deps.getLibrarian(),
		vaultActionManager: deps.getVaultActionManager(),
	});

	// Build payload from context
	const basePayload = buildPayload(
		action.kind,
		context,
		deps.getSelectionService(),
	);

	if (!basePayload) {
		logger.warn(
			`[OverlayManager] Could not build payload for: ${action.kind}`,
		);
		return;
	}

	// Merge with action params (for NavigatePage direction)
	const payload = { ...basePayload, ...action.params };

	// Execute the action
	await executor({ kind: action.kind, payload });
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
		const button = target.closest(
			DomSelectors.DATA_ACTION,
		) as HTMLElement | null;
		if (!button) return;

		// Skip disabled buttons
		if (button.hasAttribute("disabled")) return;

		const actionId = button.dataset[DomSelectors.DATA_ACTION_ATTR];
		if (!actionId) return;

		void handleActionClick(deps, actionId);
	};

	document.addEventListener("mousedown", handler, true); // capture: true
	plugin.register(() =>
		document.removeEventListener("mousedown", handler, true),
	);
}
