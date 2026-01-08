/**
 * Convert CodexAction[] to VaultAction[].
 */

import {
	type VaultAction,
	VaultActionType,
} from "../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { upsertMetadata } from "../../../../managers/pure/note-metadata-manager";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { CodexAction } from "./types/codex-action";

/**
 * Convert a single CodexAction to VaultAction.
 */
export function codexActionToVaultAction(action: CodexAction): VaultAction {
	switch (action.type) {
		case "CreateCodex":
		case "UpdateCodex":
			// Both map to UpsertMdFile
			return {
				payload: {
					content: action.payload.content,
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
				type: VaultActionType.UpsertMdFile,
			};

		case "RenameCodex":
			return {
				payload: {
					from: makeVaultScopedSplitPath(action.payload.from),
					to: makeVaultScopedSplitPath(action.payload.to),
				},
				type: VaultActionType.RenameMdFile,
			};

		case "DeleteCodex":
			return {
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
				type: VaultActionType.TrashMdFile,
			};

		case "WriteScrollStatus":
			// ProcessMdFile with transform to update metadata
			return {
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
					transform: upsertMetadata({ status: action.payload.status }),
				},
				type: VaultActionType.ProcessMdFile,
			};
	}
}

/**
 * Convert CodexAction[] to VaultAction[].
 */
export function codexActionsToVaultActions(
	actions: CodexAction[],
): VaultAction[] {
	return actions.map(codexActionToVaultAction);
}
