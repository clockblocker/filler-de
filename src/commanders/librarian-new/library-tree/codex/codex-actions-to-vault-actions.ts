/**
 * Convert CodexAction[] to VaultAction[].
 */

import {
	type VaultAction,
	VaultActionType,
} from "../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { upsertMetadata } from "../../../../managers/pure/note-metadata-manager";
import { logger } from "../../../../utils/logger";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { CodexAction } from "./types/codex-action";

/**
 * Convert a single CodexAction to VaultAction.
 */
export function codexActionToVaultAction(action: CodexAction): VaultAction {
	switch (action.type) {
		case "UpsertCodex":
			return {
				payload: {
					content: action.payload.content,
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
				},
				type: VaultActionType.UpsertMdFile,
			};

		case "DeleteCodex": {
			const vaultScopedPath = makeVaultScopedSplitPath(
				action.payload.splitPath,
			);
			const deletePath = [
				...vaultScopedPath.pathParts,
				vaultScopedPath.basename,
			].join("/");
			logger.info("[codexActionToVaultAction] Converting DeleteCodex", {
				originalPath: [
					...action.payload.splitPath.pathParts,
					action.payload.splitPath.basename,
				].join("/"),
				vaultScopedPath: deletePath,
			});
			return {
				payload: {
					splitPath: vaultScopedPath,
				},
				type: VaultActionType.TrashMdFile,
			};
		}

		case "WriteScrollStatus":
			// ProcessMdFile with transform to update metadata
			return {
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
					),
					transform: upsertMetadata({
						status: action.payload.status,
					}),
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
