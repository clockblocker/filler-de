import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { SplitPathToMdFile } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import { generateCodexContent } from "../codex";
import {
	buildCodexBasename,
	tryExtractingSplitPathToFolder,
} from "../naming/interface";
import type { NodeNameChain } from "../naming/parsed-basename";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { addCodexPrefixDeprecated } from "../utils/codex-utils";

/**
 * Build VaultActions to create/update codex files for impacted sections.
 * Pure function that takes tree node and returns actions.
 */
export function buildCodexVaultActions(
	impactedChains: NodeNameChain[],
	getNode: (chain: NodeNameChain) => SectionNode | null,
): VaultAction[] {
	const settings = getParsedUserSettings();
	const libraryRootPath = makeSystemPathForSplitPath(
		settings.splitPathToLibraryRoot,
	);
	const actions: VaultAction[] = [];

	for (const chain of impactedChains) {
		const node = getNode(chain);
		if (!node) {
			continue;
		}
		if (node.type !== TreeNodeType.Section) {
			logger.warn(
				"[buildCodexVaultActions] node is not Section:",
				node.type,
				"chain:",
				JSON.stringify(chain),
			);
			continue;
		}

		const section = node;

		const content = generateCodexContent(section, {
			libraryRoot: libraryRootPath,
		});

		// Build codex basename with suffix (same pattern as regular files)
		// Root: __Library (no suffix, use libraryRoot name)
		// Nested: __Salad-Recipe (suffix = parent chain reversed)
		const codexBasename = buildCodexBasename(section);

		// Codex path: inside the section folder
		const codexSplitPathResult =
			tryExtractingSplitPathToFolder(codexBasename);

		if (codexSplitPathResult.isErr()) {
			logger.warn(
				"[buildCodexVaultActions] failed to extract codex split path:",
				codexSplitPathResult.error,
			);
			continue;
		}
		const codexSplitPath = codexSplitPathResult.value;

		// Always use UpsertMdFile - it creates if not exists
		// This avoids triggering handleCreate which would add suffixes
		const action = {
			payload: {
				content,
				splitPath: { ...codexSplitPath, extension: "md" },
			},
			type: VaultActionType.UpsertMdFile,
		};

		actions.push(action);
	}

	return actions;
}
