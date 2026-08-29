/**
 * Convert CodexAction[] to VaultAction[].
 */

import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import type { Codecs } from "../../../codecs";
import { noteMetadataHelper } from "../../../internal/root/note-metadata";
import {
	type LibraryScope,
	makeLibraryScope,
} from "../../../tree/library-scope";
import { makeCodexTransform } from "./backlink-transforms";
import type { CodexAction } from "./types/codex-action";

/**
 * Convert a single CodexAction to VaultAction.
 */
function translateCodexAction(
	action: CodexAction,
	codecs: Codecs,
	libraryScope: LibraryScope,
): VaultAction {
	switch (action.kind) {
		case "UpsertCodex":
			return {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: action.payload.content,
					splitPath: libraryScope.toVaultPath(
						action.payload.splitPath,
					),
				},
			};

		case "WriteScrollStatus": {
			// ProcessMdFile with transform to update status while preserving other metadata
			const status = action.payload.status;
			// For frontmatter, "Unknown" status is treated as "NotStarted"
			const normalizedStatus =
				status === "Unknown" ? ("NotStarted" as const) : status;
			// Use toggleStatus which properly merges with existing frontmatter
			// (internally calls upsertFrontmatterStatus which reads existing metadata first)
			const checked = normalizedStatus === "Done";
			return {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: libraryScope.toVaultPath(
						action.payload.splitPath,
					),
					transform: noteMetadataHelper.toggleStatus(checked),
				},
			};
		}

		case "EnsureCodexFileExists":
			// UpsertMdFile with null content = ensure exists without overwrite
			return {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: null,
					splitPath: libraryScope.toVaultPath(
						action.payload.splitPath,
					),
				},
			};

		case "ProcessCodex":
			return {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: libraryScope.toVaultPath(
						action.payload.splitPath,
					),
					transform: makeCodexTransform(
						action.payload.section,
						action.payload.sectionChain,
						codecs,
					),
				},
			};
	}
}

export function codexActionToVaultAction(
	action: CodexAction,
	codecs: Codecs,
): VaultAction {
	return translateCodexAction(action, codecs, makeLibraryScope(codecs.rules));
}

/**
 * Convert CodexAction[] to VaultAction[].
 */
export function codexActionsToVaultActions(
	actions: CodexAction[],
	codecs: Codecs,
): VaultAction[] {
	const libraryScope = makeLibraryScope(codecs.rules);
	return actions.map((action) =>
		translateCodexAction(action, codecs, libraryScope),
	);
}
