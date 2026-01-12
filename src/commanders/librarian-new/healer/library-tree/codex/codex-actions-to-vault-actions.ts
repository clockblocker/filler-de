/**
 * Convert CodexAction[] to VaultAction[].
 */

import {
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { upsertMetadata } from "../../../../../managers/pure/note-metadata-manager";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { CodexAction } from "./types/codex-action";

/**
 * Convert a single CodexAction to VaultAction.
 */
export function codexActionToVaultAction(action: CodexAction): VaultAction {
	switch (action.kind) {
		case "UpsertCodex":
			return {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: action.payload.content,
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
			};

		case "DeleteCodex": {
			const vaultScopedPath = makeVaultScopedSplitPath(
				action.payload.splitPath,
			);

			return {
				kind: VaultActionKind.TrashMdFile,
				payload: {
					splitPath: vaultScopedPath,
				},
			};
		}

		case "WriteScrollStatus":
			// ProcessMdFile with transform to update metadata
			return {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
					transform: upsertMetadata({
						status: action.payload.status,
					}),
				},
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
