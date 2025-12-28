import { MD } from "../../../obsidian-vault-action-manager/types/literals";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import type { NodeNameChain } from "../../librarin-shared/types/node-name";
import type { SectionNode } from "../../librarin-shared/types/tree-node";
import { generateCodexContent } from "../codex";
import {
	buildCanonicalPathPartsForCodex,
	makeCanonicalBasenameForCodexFromSectionNode,
} from "../naming/functions/codexes";

/**
 * Build VaultActions to create/update codex files for impacted sections.
 *
 * INVARIANT: getSectionNode returns state of the updated tree
 */
export function buildCodexVaultActions(
	nodeNameChainsToImpactedSections: NodeNameChain[],
	getSectionNode: (chain: NodeNameChain) => SectionNode | null,
): VaultAction[] {
	const actions: VaultAction[] = [];

	for (const nodeNameChainToSection of nodeNameChainsToImpactedSections) {
		const sectionNode = getSectionNode(nodeNameChainToSection);
		if (!sectionNode) {
			continue;
		}

		const content = generateCodexContent(sectionNode);

		const codexBasename =
			makeCanonicalBasenameForCodexFromSectionNode(sectionNode);

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
