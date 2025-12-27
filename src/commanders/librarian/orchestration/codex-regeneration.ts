import {
	type SplitPath,
	SplitPathType,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { tryParseJoinedSuffixedBasenameForCodex } from "../naming/codecs/atomic/parsers";
import { makeNodeNameChainFromPathParts } from "../naming/codecs/atomic/path-parts-and-node-name-chain";
import { makeCanonicalBasenameForCodex } from "../naming/functions/codexes";
import type { NodeNameChain } from "../naming/types/node-name";
import type { SectionNode } from "../types/tree-node";
import { buildCodexVaultActions } from "./codex-builder";

export function buildActionsForCodexRegenerationInImpactedSections(
	nodeNameChains: NodeNameChain[],
	splitPathsToFiles: SplitPath[],
	getSectionNode: (chain: NodeNameChain) => SectionNode | null,
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
	getSectionNode: (chain: NodeNameChain) => SectionNode | null,
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

		const canonicalBasenameForCodex = makeCanonicalBasenameForCodex(
			nodeNameChainToParent,
		);

		if (splitPathToImpactedFile.basename !== canonicalBasenameForCodex) {
			deleteActions.push({
				payload: { splitPath: splitPathToCodex },
				type: VaultActionType.TrashMdFile,
			});
		}
	}

	return deleteActions;
}
