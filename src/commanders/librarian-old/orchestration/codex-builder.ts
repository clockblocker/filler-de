import { MD } from "../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathType } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { generateCodexContent } from "../codex";
import {
	buildCanonicalPathPartsForCodex,
	makeCanonicalBasenameForCodexFromSectionNode,
} from "../naming/functions/codexes";
import type { NodeNameChainDeprecated } from "../types/schemas/node-name";
import type { SectionNodeDeprecated } from "../types/tree-node";

/**
 * Build VaultActions to create/update codex files for impacted sections.
 *
 * INVARIANT: getSectionNode returns state of the updated tree
 */
export function buildCodexVaultActions(
	nodeNameChainsToImpactedSections: NodeNameChainDeprecated[],
	getSectionNode: (
		chain: NodeNameChainDeprecated,
	) => SectionNodeDeprecated | null,
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
