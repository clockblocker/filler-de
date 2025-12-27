import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import { MD } from "../../../obsidian-vault-action-manager/types/literals";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { generateCodexContent } from "../codex";
import {
	buildCanonicalBasenameForCodex,
	buildCanonicalPathPartsForCodex,
} from "../naming/codecs/codexes/interface";
import type { NodeNameChain } from "../naming/types/node-name";
import type { SectionNode } from "../types/tree-node";

/**
 * Build VaultActions to create/update codex files for impacted sections.
 *
 * INVARIANT: getSectionNode returns state of the updated tree
 */
export function buildCodexVaultActions(
	nodeNameChainsToImpactedSections: NodeNameChain[],
	getSectionNode: (chain: NodeNameChain) => SectionNode | null,
): VaultAction[] {
	const settings = getParsedUserSettings();
	const libraryRootPath = makeSystemPathForSplitPath(
		settings.splitPathToLibraryRoot,
	);
	const actions: VaultAction[] = [];

	for (const nodeNameChainToSection of nodeNameChainsToImpactedSections) {
		const sectionNode = getSectionNode(nodeNameChainToSection);
		if (!sectionNode) {
			continue;
		}

		const content = generateCodexContent(sectionNode, {
			libraryRoot: libraryRootPath,
		});

		const codexBasename = buildCanonicalBasenameForCodex(
			nodeNameChainToSection,
		);

		const codexPathParts = buildCanonicalPathPartsForCodex(codexBasename);

		actions.push({
			payload: {
				content,
				splitPath: {
					basename: codexBasename,
					extension: MD,
					pathParts: codexPathParts,
					type: SplitPathType.MdFile,
				},
			},
			type: VaultActionType.UpsertMdFile,
		});
	}

	return actions;
}
