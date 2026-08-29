/**
 * Converts library-scoped HealingActions to vault-scoped VaultActions.
 */

import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import type { HealingAction } from "../healer/library-tree/types/healing-action";
import { type LibraryScope, makeLibraryScope } from "../tree/library-scope";
import type { Codecs } from ".";

function translateHealingAction(
	action: HealingAction,
	libraryScope: LibraryScope,
): VaultAction {
	switch (action.kind) {
		case "RenameFolder":
			return {
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: libraryScope.toVaultPath(action.payload.from),
					to: libraryScope.toVaultPath(action.payload.to),
				},
			};
		case "RenameFile":
			return {
				kind: VaultActionKind.RenameFile,
				payload: {
					from: libraryScope.toVaultPath(action.payload.from),
					to: libraryScope.toVaultPath(action.payload.to),
				},
			};
		case "RenameMdFile":
			return {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: libraryScope.toVaultPath(action.payload.from),
					to: libraryScope.toVaultPath(action.payload.to),
				},
			};
		case "DeleteMdFile":
			return {
				kind: VaultActionKind.TrashMdFile,
				payload: {
					splitPath: libraryScope.toVaultPath(
						action.payload.splitPath,
					),
				},
			};
	}
}

export function healingActionToVaultAction(
	action: HealingAction,
	codecs: Codecs,
): VaultAction {
	return translateHealingAction(action, makeLibraryScope(codecs.rules));
}

export function healingActionsToVaultActions(
	actions: HealingAction[],
	codecs: Codecs,
): VaultAction[] {
	const libraryScope = makeLibraryScope(codecs.rules);
	return actions.map((action) =>
		translateHealingAction(action, libraryScope),
	);
}
