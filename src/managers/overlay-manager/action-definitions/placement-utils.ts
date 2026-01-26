/**
 * Utilities for computing action placements.
 */

import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SelectionActionPlacement } from "../../../types";
import type { ActionConfig } from "../bottom-toolbar";
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
 * Compute which actions go to which toolbar based on current settings.
 */
export function computeAllowedActions(): ComputedActions {
	const settings = getParsedUserSettings();
	const selectionActions: ActionConfig[] = [];
	const bottomActions: ActionConfig[] = [];

	for (const def of Object.values(ACTION_DEFINITIONS)) {
		const placement = settings[
			def.settingKey as keyof typeof settings
		] as SelectionActionPlacement;

		if (placement === OverlayPlacement.AboveSelection) {
			selectionActions.push({ id: def.id, label: def.label });
		} else if (placement === OverlayPlacement.Bottom) {
			bottomActions.push({ id: def.id, label: def.label });
		}
		// ShortcutOnly actions go to neither toolbar
	}

	return { bottomActions, selectionActions };
}
