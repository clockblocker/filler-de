/**
 * Utilities for computing action placements.
 */

import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SelectionActionPlacement } from "../../../types";
import { CommandKind } from "../../obsidian/user-actions-manager";
import type { ActionConfig } from "../bottom-toolbar/types";
import { ACTION_DEFINITIONS } from "./definitions";
import { OverlayPlacement } from "./types";

/**
 * Computed actions for each toolbar placement.
 */
export type ComputedActions = {
	selectionActions: ActionConfig[];
	bottomActions: ActionConfig[];
};

/**
 * Page metadata for navigation buttons.
 */
export type PageNavMetadata = {
	noteKind?: string;
	prevPageIdx?: number;
	nextPageIdx?: number;
};

/**
 * Compute which actions go to which toolbar based on current settings.
 * Does NOT include navigation buttons - use computeNavActions() separately.
 */
export function computeAllowedActions(): ComputedActions {
	const settings = getParsedUserSettings();
	const selectionActions: ActionConfig[] = [];
	const bottomActions: ActionConfig[] = [];

	for (const def of Object.values(ACTION_DEFINITIONS)) {
		// Skip nav buttons - they're computed separately with metadata
		if (def.settingKey === null) continue;

		const placement = settings[
			def.settingKey as keyof typeof settings
		] as SelectionActionPlacement;

		if (placement === OverlayPlacement.AboveSelection) {
			selectionActions.push({ id: def.id, label: def.label });
		} else if (placement === OverlayPlacement.Bottom) {
			bottomActions.push({
				contextual: def.requiresSelection,
				id: def.id,
				label: def.label,
			});
		}
		// ShortcutOnly actions go to neither toolbar
	}

	return { bottomActions, selectionActions };
}

/**
 * Compute navigation button actions based on page metadata.
 * Returns nav buttons only if noteKind === "Page".
 * Buttons are disabled based on prevPageIdx/nextPageIdx presence.
 */
export function computeNavActions(
	metadata: PageNavMetadata | null,
): ActionConfig[] {
	// Only show nav buttons for Page notes
	if (!metadata || metadata.noteKind !== "Page") {
		return [];
	}

	// No buttons if neither index is present
	const hasAnyIndex =
		metadata.prevPageIdx !== undefined ||
		metadata.nextPageIdx !== undefined;
	if (!hasAnyIndex) {
		return [];
	}

	return [
		{
			contextual: false,
			disabled: metadata.prevPageIdx === undefined,
			id: CommandKind.GoToPrevPage,
			label: "<",
		},
		{
			contextual: false,
			disabled: metadata.nextPageIdx === undefined,
			id: CommandKind.GoToNextPage,
			label: ">",
		},
	];
}
