import {
	type SplitPath,
	SplitPathType,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { tryParseJoinedSuffixedBasenameForCodex } from "../naming/codecs/atomic/parsers";
import { makeNodeNameChainFromPathParts } from "../naming/codecs/atomic/path-parts-and-node-name-chain";
import { makeCanonicalBasenameForCodexFromSectionNode } from "../naming/functions/codexes";
import type { NodeNameChainDeprecated } from "../types/schemas/node-name";
import type { SectionNodeDeprecated } from "../types/tree-node";
import { buildCodexVaultActions } from "./codex-builder";

export function buildActionsForCodexRegenerationInImpactedSections(
	nodeNameChains: NodeNameChainDeprecated[],
	splitPathsToFiles: SplitPath[],
	getSectionNode: (
		chain: NodeNameChainDeprecated,
	) => SectionNodeDeprecated | null,
): VaultAction[] {
	if (nodeNameChains.length === 0) {
		return [];
	}

	const upsertCodexActions = buildCodexVaultActions(
		nodeNameChains,
		getSectionNode,
	);

	const deleteCodexActions = buildDeleteActionsForOrphanedCodexes(
		splitPathsToFiles,
		getSectionNode,
	);

	return [...upsertCodexActions, ...deleteCodexActions];
}

function buildDeleteActionsForOrphanedCodexes(
	splitPathsToFiles: SplitPath[],
	getSectionNode: (
		chain: NodeNameChainDeprecated,
	) => SectionNodeDeprecated | null,
): VaultAction[] {
	const deleteActions: VaultAction[] = [];

	for (const splitPathToImpactedFile of splitPathsToFiles) {
		if (
			splitPathToImpactedFile.type !== SplitPathType.MdFile ||
			tryParseJoinedSuffixedBasenameForCodex(
				splitPathToImpactedFile.basename,
			).isErr()
		) {
			continue;
		}

		const splitPathToCodex = splitPathToImpactedFile;

		const nodeNameChainToParent = makeNodeNameChainFromPathParts(
			splitPathToCodex.pathParts,
		);
		const parentSectionNode = getSectionNode(nodeNameChainToParent);

		if (!parentSectionNode) {
			deleteActions.push({
				payload: { splitPath: splitPathToCodex },
				type: VaultActionType.TrashMdFile,
			});
			continue;
		}

		const canonicalBasenameForCodex =
			makeCanonicalBasenameForCodexFromSectionNode(parentSectionNode);

		if (splitPathToImpactedFile.basename !== canonicalBasenameForCodex) {
			deleteActions.push({
				payload: { splitPath: splitPathToCodex },
				type: VaultActionType.TrashMdFile,
			});
		}
	}

	return deleteActions;
}
