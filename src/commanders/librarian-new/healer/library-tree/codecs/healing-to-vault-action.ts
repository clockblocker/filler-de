/**
 * Converts library-scoped HealingActions to vault-scoped VaultActions.
 */

import {
	type VaultAction,
	VaultActionType,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { HealingAction } from "../types/healing-action";

export function healingActionToVaultAction(action: HealingAction): VaultAction {
	switch (action.type) {
		case "CreateFolder":
			return {
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
				type: VaultActionType.CreateFolder,
			};
		case "RenameFolder":
			return {
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
				type: VaultActionType.RenameFolder,
			};
		case "RenameFile":
			return {
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
				type: VaultActionType.RenameFile,
			};
		case "RenameMdFile":
			return {
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
				type: VaultActionType.RenameMdFile,
			};
		case "DeleteMdFile":
			return {
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
				type: VaultActionType.TrashMdFile,
			};
	}
}

export function healingActionsToVaultActions(
	actions: HealingAction[],
): VaultAction[] {
	return actions.map(healingActionToVaultAction);
}
