import { z } from "zod";
import type { MD } from "../../../managers/obsidian/vault-action-manager/types/literals";
import type {
	SplitPathToMdFile,
	SplitPathWithReader,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { readMetadata } from "../../../stateless-helpers/note-metadata-service";
import { parseFrontmatter } from "../../../stateless-helpers/note-metadata-service/internal/frontmatter";
import { readJsonSection } from "../../../stateless-helpers/note-metadata-service/internal/json-section";
import {
	addFrontmatter,
	migrateFrontmatter,
	migrateToFrontmatter,
} from "../../../stateless-helpers/note-metadata-service/internal/migration";
import { logger } from "../../../utils/logger";
import type {
	AnySplitPathInsideLibrary,
	CodecRules,
	Codecs,
	SplitPathToMdFileInsideLibrary,
} from "../codecs";
import { isCodexSplitPath } from "../healer/library-tree/codex/helpers";
import {
	makeVaultScopedSplitPath,
	tryParseAsInsideLibrarySplitPath,
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

/**
 * Build CreateTreeLeafAction for each file in the library.
 * Applies policy (NameKing for root, PathKing for nested) to determine canonical location.
 * Reads status from md file metadata or YAML frontmatter.
 * Returns migration actions for files that need format conversion.
 *
 * @param files - Files from vault with readers
 * @param codecs - Codec API
 * @param rules - Codec rules (includes hideMetadata setting)
 */
export async function buildInitialCreateActions(
	files: SplitPathWithReader[],
	codecs: Codecs,
	rules: CodecRules,
): Promise<BuildInitialActionsResult> {
	const createActions: CreateTreeLeafAction[] = [];
	const migrationActions: VaultAction[] = [];

	for (const file of files) {
		// Skip codex files (basename starts with __)
		if (isCodexSplitPath(file)) {
			continue;
		}

		// Convert to library-scoped path
		const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
			file,
			rules,
		);
		if (libraryScopedResult.isErr()) {
			logger.warn(
				`[Librarian] Skipping file outside library: ${file.basename}`,
			);
			continue;
		}
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
			logger.error(
				`[Librarian] Failed to parse file: ${file.basename}`,
				canonicalResult.error,
			);
			continue;
		}
		const canonicalPath = canonicalResult.value;

		// Build locator from canonical path
		const locatorResult =
			codecs.locator.canonicalSplitPathInsideLibraryToLocator(
				canonicalPath,
			);
		if (locatorResult.isErr()) {
			logger.error(
				`[Librarian] Failed to build locator: ${file.basename}`,
				locatorResult.error,
			);
			continue;
		}
		const locator = locatorResult.value;

		// Read status for md files
		let status: TreeNodeStatus = TreeNodeStatus.NotStarted;
		if (file.kind === SplitPathKind.MdFile && "read" in file) {
			const contentResult = await file.read();
			if (contentResult.isOk()) {
				const content = contentResult.value;

				// Read metadata using unified API (tries JSON first, then YAML)
				const meta = readMetadata(content, ScrollMetadataSchema);
				if (meta?.status === "Done") {
					status = TreeNodeStatus.Done;
				}

				// Check which formats exist for migration
				const hasInternal =
					readJsonSection(content, ScrollMetadataSchema) !== null;
				const hasFrontmatter = parseFrontmatter(content) !== null;

				// Cast observedPath to MdFile since we're inside file.kind === MdFile check
				const mdPath = observedPath as SplitPathToMdFileInsideLibrary;
				const vaultMdPath = makeVaultScopedSplitPath(
					mdPath,
					rules,
				) as SplitPathToMdFile;

				if (rules.hideMetadata) {
					// Want internal format - migrate YAML to internal if needed
					if (hasFrontmatter && !hasInternal) {
						migrationActions.push({
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: vaultMdPath,
								transform: migrateFrontmatter({
									stripYaml: true,
								}),
							},
						});
					}
				} else {
					// Want YAML format
					if (hasInternal && meta) {
						// Convert internal to YAML
						migrationActions.push({
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: vaultMdPath,
								transform: migrateToFrontmatter(meta),
							},
						});
					} else if (!hasFrontmatter) {
						// No metadata at all - add YAML with current status
						const statusValue =
							status === TreeNodeStatus.Done
								? TreeNodeStatus.Done
								: TreeNodeStatus.NotStarted;

						migrationActions.push({
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: vaultMdPath,
								transform: addFrontmatter({
									status: statusValue,
								}),
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
					extension: MD;
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
