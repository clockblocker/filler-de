import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { SplitPathToMdFile } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import { generateCodexContent } from "../codex";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { buildCodexBasename } from "../utils/codex-utils";

/**
 * Build VaultActions to create/update codex files for impacted sections.
 * Pure function that takes tree node and returns actions.
 */
export function buildCodexVaultActions(
	impactedChains: CoreNameChainFromRoot[],
	getNode: (chain: CoreNameChainFromRoot) => SectionNode | null,
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

		const section = node as SectionNode;

		const content = generateCodexContent(section, {
			libraryRoot: libraryRootPath,
		});

		// Build codex basename with suffix (same pattern as regular files)
		// Root: __Library (no suffix, use libraryRoot name)
		// Nested: __Salad-Recipe (suffix = parent chain reversed)
		const codexBasename = buildCodexBasename(section);

		// Codex path: inside the section folder
		const pathParts = [
			...settings.splitPathToLibraryRoot.pathParts,
			settings.splitPathToLibraryRoot.basename,
			...chain,
		];
		const codexSplitPath: SplitPathToMdFile = {
			basename: codexBasename,
			extension: "md",
			pathParts,
			type: SplitPathType.MdFile,
		};

		// Always use UpsertMdFile - it creates if not exists
		// This avoids triggering handleCreate which would add suffixes
		const action = {
			payload: { content, splitPath: codexSplitPath },
			type: VaultActionType.UpsertMdFile,
		};
		logger.debug(
			"[buildCodexVaultActions] creating action for:",
			JSON.stringify({
				chain,
				codexBasename,
				codexPath: makeSystemPathForSplitPath(codexSplitPath),
				contentLength: content.length,
			}),
		);
		actions.push(action);
	}

	return actions;
}
