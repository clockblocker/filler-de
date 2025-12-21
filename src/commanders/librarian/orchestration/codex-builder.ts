import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { SplitPathToMdFile } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
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
			console.log("[buildCodexVaultActions] no node for chain:", chain);
			continue;
		}
		if (node.type !== TreeNodeType.Section) {
			console.log(
				"[buildCodexVaultActions] node is not Section:",
				node.type,
				"chain:",
				chain,
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
		const sectionName =
			chain.length === 0
				? settings.splitPathToLibraryRoot.basename
				: section.coreName;
		const coreCodexName = buildCodexBasename(sectionName);
		const suffix =
			chain.length > 0
				? chain
						.slice(0, -1) // Parent chain (exclude self)
						.reverse()
						.join(settings.suffixDelimiter)
				: "";
		const codexBasename = suffix
			? `${coreCodexName}${settings.suffixDelimiter}${suffix}`
			: coreCodexName;

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

		// Always use ReplaceContentMdFile - it creates if not exists
		// This avoids triggering handleCreate which would add suffixes
		const action = {
			payload: { content, splitPath: codexSplitPath },
			type: VaultActionType.ReplaceContentMdFile,
		};
		console.log("[buildCodexVaultActions] creating action for:", {
			chain,
			codexBasename,
			codexPath: makeSystemPathForSplitPath(codexSplitPath),
			contentLength: content.length,
		});
		actions.push(action);
	}

	return actions;
}
