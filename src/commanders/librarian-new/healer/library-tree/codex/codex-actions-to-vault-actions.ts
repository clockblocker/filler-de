/**
 * Convert CodexAction[] to VaultAction[].
 */

import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { upsertMetadata } from "../../../../../managers/pure/note-metadata-manager";
import type { CodecRules } from "../../../codecs/rules";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { CodexAction } from "./types/codex-action";

/**
 * Convert a single CodexAction to VaultAction.
 */
export function codexActionToVaultAction(
	action: CodexAction,
	rules: CodecRules,
): VaultAction {
	switch (action.kind) {
		case "UpsertCodex":
			return {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: action.payload.content,
					// Type assertion: SplitPathToMdFileInsideLibrary → SplitPathToMdFile via EnscopedSplitPath
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					) as SplitPathToMdFile,
				},
			};

		case "DeleteCodex": {
			// Type assertion: SplitPathToMdFileInsideLibrary → SplitPathToMdFile via EnscopedSplitPath
			const vaultScopedPath = makeVaultScopedSplitPath(
				action.payload.splitPath,
				rules,
			) as SplitPathToMdFile;

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
					// Type assertion: SplitPathToMdFileInsideLibrary → SplitPathToMdFile via EnscopedSplitPath
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					) as SplitPathToMdFile,
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
	rules: CodecRules,
): VaultAction[] {
	return actions.map((action) => codexActionToVaultAction(action, rules));
}
