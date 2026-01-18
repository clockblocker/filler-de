import { z } from "zod";
import type { SplitPathWithReader } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import {
	readMetadata,
	parseFrontmatter,
	frontmatterToInternal,
	migrateFrontmatter,
} from "../../../managers/pure/note-metadata-manager";
import type { AnySplitPathInsideLibrary, CodecRules, Codecs } from "../codecs";
import { isCodexSplitPath } from "../healer/library-tree/codex/helpers";
import {
	tryParseAsInsideLibrarySplitPath,
	makeVaultScopedSplitPath,
} from "../healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import { inferCreatePolicy } from "../healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/infer-create";
import type { CreateTreeLeafAction } from "../healer/library-tree/tree-action/types/tree-action";
import { tryCanonicalizeSplitPathToDestination } from "../healer/library-tree/tree-action/utils/canonical-naming/canonicalize-to-destination";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../healer/library-tree/tree-node/types/atoms";

// ─── Scroll Metadata Schema ───

const ScrollMetadataSchema = z
	.object({
		status: z.enum(["Done", "NotStarted"]),
	})
	.passthrough();

export type BuildInitialActionsResult = {
	createActions: CreateTreeLeafAction[];
	migrationActions: VaultAction[];
};

export type BuildInitialActionsOptions = {
	/** Whether to strip YAML frontmatter after conversion. Default: true */
	stripYamlFrontmatter?: boolean;
};

/**
 * Build CreateTreeLeafAction for each file in the library.
 * Applies policy (NameKing for root, PathKing for nested) to determine canonical location.
 * Reads status from md file metadata or YAML frontmatter.
 * Returns migration actions for files that need frontmatter conversion.
 *
 * @param files - Files from vault with readers
 * @param codecs - Codec API
 * @param rules - Codec rules
 * @param options - Optional settings
 */
export async function buildInitialCreateActions(
	files: SplitPathWithReader[],
	codecs: Codecs,
	rules: CodecRules,
	options?: BuildInitialActionsOptions,
): Promise<BuildInitialActionsResult> {
	const stripYaml = options?.stripYamlFrontmatter ?? true;
	const createActions: CreateTreeLeafAction[] = [];
	const migrationActions: VaultAction[] = [];

	for (const file of files) {
		// Skip codex files (basename starts with __)
		if (isCodexSplitPath(file, codecs)) {
			continue;
		}

		// Convert to library-scoped path
		const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
			file,
			rules,
		);
		if (libraryScopedResult.isErr()) continue;
		const observedPath = libraryScopedResult.value;

		// Apply policy to get canonical destination
		// NameKing for root-level files, PathKing for nested
		const policy = inferCreatePolicy(observedPath);
		const canonicalResult = tryCanonicalizeSplitPathToDestination(
			observedPath,
			policy,
			undefined, // no rename intent for create
			codecs,
		);
		if (canonicalResult.isErr()) {
			continue;
		}
		const canonicalPath = canonicalResult.value;

		// Build locator from canonical path
		const locatorResult =
			codecs.locator.canonicalSplitPathInsideLibraryToLocator(
				canonicalPath,
			);
		if (locatorResult.isErr()) continue;
		const locator = locatorResult.value;

		// Read status for md files
		let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
		if (file.kind === SplitPathKind.MdFile && "read" in file) {
			const contentResult = await file.read();
			if (contentResult.isOk()) {
				const content = contentResult.value;

				// Try internal metadata format first
				const meta = readMetadata(content, ScrollMetadataSchema);
				if (meta?.status === "Done") {
					status = TreeNodeStatus.Done;
				} else if (!meta) {
					// Fallback: try YAML frontmatter
					const fm = parseFrontmatter(content);
					if (fm) {
						const converted = frontmatterToInternal(fm);
						if (converted.status === "Done") {
							status = TreeNodeStatus.Done;
						}

						// Queue migration action to convert frontmatter to internal format
						migrationActions.push({
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: makeVaultScopedSplitPath(observedPath, rules),
								transform: migrateFrontmatter({ stripYaml }),
							},
						});
					}
				}
			}
		}

		if (locator.targetKind === TreeNodeKind.Scroll) {
			createActions.push({
				actionType: "Create",
				initialStatus: status,
				observedSplitPath: observedPath as AnySplitPathInsideLibrary & {
					kind: typeof SplitPathKind.MdFile;
					extension: "md";
				},
				targetLocator: locator,
			});
		} else if (locator.targetKind === TreeNodeKind.File) {
			createActions.push({
				actionType: "Create",
				observedSplitPath: observedPath as AnySplitPathInsideLibrary & {
					kind: typeof SplitPathKind.File;
					extension: string;
				},
				targetLocator: locator,
			});
		}
	}

	return { createActions, migrationActions };
}
