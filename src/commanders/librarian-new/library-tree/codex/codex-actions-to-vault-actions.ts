/**
 * Convert CodexAction[] to VaultAction[].
 */

import {
	type VaultAction,
	VaultActionType,
} from "../../../../obsidian-vault-action-manager/types/vault-action";
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
					splitPath: makeVaultScopedSplitPath(action.payload.splitPath),
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
					splitPath: makeVaultScopedSplitPath(action.payload.splitPath),
				},
				type: VaultActionType.TrashMdFile,
			};

		case "WriteScrollStatus":
			// ProcessMdFile with transform to update metadata
			return {
				payload: {
					splitPath: makeVaultScopedSplitPath(action.payload.splitPath),
					transform: (content: string) =>
						updateStatusInContent(content, action.payload.status),
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

// ─── Helpers ───

/**
 * Update status in markdown content metadata.
 * Simple implementation - can be enhanced later.
 */
function updateStatusInContent(
	content: string,
	status: string,
): string {
	// Look for existing status in frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		const statusMatch = frontmatter?.match(/^status:\s*.+$/m);

		if (statusMatch) {
			// Replace existing status
			const newFrontmatter = frontmatter?.replace(
				/^status:\s*.+$/m,
				`status: ${status}`,
			);
			return content.replace(
				/^---\n[\s\S]*?\n---/,
				`---\n${newFrontmatter}\n---`,
			);
		}
		// Add status to existing frontmatter
		return content.replace(
			/^---\n/,
			`---\nstatus: ${status}\n`,
		);
	}

	// No frontmatter - add it
	return `---\nstatus: ${status}\n---\n${content}`;
}
