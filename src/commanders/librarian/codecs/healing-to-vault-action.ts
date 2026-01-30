/**
 * Converts library-scoped HealingActions to vault-scoped VaultActions.
 */

import {
	type VaultAction,
	VaultActionKind,
} from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { makeVaultScopedSplitPath } from "../healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { HealingAction } from "../healer/library-tree/types/healing-action";
import type { CodecRules } from "./rules";

export function healingActionToVaultAction(
	action: HealingAction,
	rules: CodecRules,
): VaultAction {
	switch (action.kind) {
		case "RenameFolder":
			return {
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from, rules),
					to: makeVaultScopedSplitPath(action.payload.to, rules),
				},
			};
		case "RenameFile":
			return {
				kind: VaultActionKind.RenameFile,
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from, rules),
					to: makeVaultScopedSplitPath(action.payload.to, rules),
				},
			};
		case "RenameMdFile":
			return {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from, rules),
					to: makeVaultScopedSplitPath(action.payload.to, rules),
				},
			};
		case "DeleteMdFile":
			return {
				kind: VaultActionKind.TrashMdFile,
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					),
				},
			};
	}
}

export function healingActionsToVaultActions(
	actions: HealingAction[],
	rules: CodecRules,
): VaultAction[] {
	return actions.map((action) => healingActionToVaultAction(action, rules));
}
