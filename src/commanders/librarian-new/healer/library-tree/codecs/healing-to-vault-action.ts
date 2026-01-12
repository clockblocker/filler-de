/**
 * Converts library-scoped HealingActions to vault-scoped VaultActions.
 */

import {
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { HealingAction } from "../types/healing-action";

export function healingActionToVaultAction(action: HealingAction): VaultAction {
	switch (action.kind) {
		case "CreateFolder":
			return {
				kind: VaultActionKind.CreateFolder,
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
			};
		case "RenameFolder":
			return {
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
			};
		case "RenameFile":
			return {
				kind: VaultActionKind.RenameFile,
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
			};
		case "RenameMdFile":
			return {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
			};
		case "DeleteMdFile":
			return {
				kind: VaultActionKind.TrashMdFile,
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
			};
	}
}

export function healingActionsToVaultActions(
	actions: HealingAction[],
): VaultAction[] {
	return actions.map(healingActionToVaultAction);
}
