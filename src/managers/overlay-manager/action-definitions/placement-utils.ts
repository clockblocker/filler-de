/**
 * Utilities for computing action placements.
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import type { Librarian } from "../../../commanders/librarian/librarian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SelectionActionPlacement } from "../../../types";
import { CommandKind } from "../../obsidian/command-executor";
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
 * Compute which actions go to which toolbar based on current settings.
 * Does NOT include navigation buttons - use computeNavActions() separately.
 */
export function computeAllowedActions(): ComputedActions {
	const settings = getParsedUserSettings();
	const selectionActions: ActionConfig[] = [];
	const bottomActions: ActionConfig[] = [];

	for (const def of Object.values(ACTION_DEFINITIONS)) {
		// Skip nav buttons - they're computed separately from Librarian state.
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
 * Compute navigation button actions for a library markdown file.
 * Buttons are disabled when there is no adjacent target.
 */
export function computeNavActions(
	librarian: Librarian,
	splitPath: SplitPathToMdFile,
): ActionConfig[] {
	const prevPath = librarian.getPrevPage(splitPath);
	const nextPath = librarian.getNextPage(splitPath);
	if (!prevPath && !nextPath) {
		return [];
	}

	return [
		{
			contextual: false,
			disabled: prevPath === null,
			id: CommandKind.GoToPrevPage,
			label: "<",
		},
		{
			contextual: false,
			disabled: nextPath === null,
			id: CommandKind.GoToNextPage,
			label: ">",
		},
	];
}
