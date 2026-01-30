/**
 * Convert CodexAction[] to VaultAction[].
 */

import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { upsertMetadata } from "../../../../../stateless-helpers/note-metadata-service";
import type { Codecs } from "../../../codecs";
import type { CodecRules } from "../../../codecs/rules";
import { makeVaultScopedSplitPath } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import {
	makeCodexTransform,
	makeScrollBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "./backlink-transforms";
import type { CodexAction } from "./types/codex-action";

/**
 * Convert a single CodexAction to VaultAction.
 */
export function codexActionToVaultAction(
	action: CodexAction,
	rules: CodecRules,
	codecs: Codecs,
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

		case "WriteScrollStatus": {
			// ProcessMdFile with transform to update metadata
			// upsertMetadata internally uses hideMetadata setting to choose format
			const status = action.payload.status;
			// For frontmatter, "Unknown" status is treated as "NotStarted"
			const normalizedStatus =
				status === "Unknown" ? ("NotStarted" as const) : status;
			return {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					// Type assertion: SplitPathToMdFileInsideLibrary → SplitPathToMdFile via EnscopedSplitPath
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					) as SplitPathToMdFile,
					transform: upsertMetadata({ status: normalizedStatus }),
				},
			};
		}

		case "EnsureCodexFileExists":
			// UpsertMdFile with null content = ensure exists without overwrite
			return {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: null,
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					) as SplitPathToMdFile,
				},
			};

		case "ProcessCodex":
			return {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					) as SplitPathToMdFile,
					transform: makeCodexTransform(
						action.payload.section,
						action.payload.sectionChain,
						codecs,
					),
				},
			};

		case "ProcessScrollBacklink":
			return {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: makeVaultScopedSplitPath(
						action.payload.splitPath,
						rules,
					) as SplitPathToMdFile,
					transform: rules.showScrollBacklinks
						? makeScrollBacklinkTransform(
								action.payload.parentChain,
								codecs,
							)
						: makeStripScrollBacklinkTransform(),
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
	codecs: Codecs,
): VaultAction[] {
	return actions.map((action) =>
		codexActionToVaultAction(action, rules, codecs),
	);
}
