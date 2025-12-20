import type { SplitPathToMdFile } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { generateCodexContent } from "../codex";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { buildCodexBasename } from "../utils/codex-utils";

export type CodexBuilderContext = {
	libraryRoot: string;
	suffixDelimiter: string;
};

/**
 * Build VaultActions to create/update codex files for impacted sections.
 * Pure function that takes tree node and returns actions.
 */
export function buildCodexVaultActions(
	impactedChains: CoreNameChainFromRoot[],
	getNode: (chain: CoreNameChainFromRoot) => SectionNode | null,
	context: CodexBuilderContext,
): VaultAction[] {
	const actions: VaultAction[] = [];

	for (const chain of impactedChains) {
		const node = getNode(chain);
		if (!node || node.type !== TreeNodeType.Section) {
			continue;
		}

		const section = node as SectionNode;

		const content = generateCodexContent(section, {
			libraryRoot: context.libraryRoot,
			suffixDelimiter: context.suffixDelimiter,
		});

		// Build codex basename with suffix (same pattern as regular files)
		// Root: __Library (no suffix, use libraryRoot name)
		// Nested: __Salad-Recipe (suffix = parent chain reversed)
		const sectionName =
			chain.length === 0 ? context.libraryRoot : section.coreName;
		const coreCodexName = buildCodexBasename(sectionName);
		const suffix =
			chain.length > 0
				? chain
						.slice(0, -1) // Parent chain (exclude self)
						.reverse()
						.join(context.suffixDelimiter)
				: "";
		const codexBasename = suffix
			? `${coreCodexName}${context.suffixDelimiter}${suffix}`
			: coreCodexName;

		// Codex path: inside the section folder
		const pathParts = [context.libraryRoot, ...chain];
		const codexSplitPath: SplitPathToMdFile = {
			basename: codexBasename,
			extension: "md",
			pathParts,
			type: SplitPathType.MdFile,
		};

		// Always use ReplaceContentMdFile - it creates if not exists
		// This avoids triggering handleCreate which would add suffixes
		actions.push({
			payload: { content, splitPath: codexSplitPath },
			type: VaultActionType.ReplaceContentMdFile,
		});
	}

	return actions;
}
