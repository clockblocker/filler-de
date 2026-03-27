/**
 * Singular backlink healing: set or strip go-back links for all library md files.
 * Runs on init and on rename/move; uses only goBackLinkHelper for link building.
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager/types/vault-action";
import type { Codecs, CodecRules } from "@textfresser/library-core/codecs";
import {
	collectTreeData,
	computeCodexSplitPath,
} from "@textfresser/library-core/codex";
import {
	makeBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "@textfresser/library-core/healer/library-tree/codex/transforms/scroll-transforms";
import { makeVaultScopedSplitPath } from "@textfresser/library-core/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { TreeReader } from "@textfresser/library-core/healer/library-tree/tree-interfaces";
import { computeScrollSplitPath } from "@textfresser/library-core/healer/library-tree/utils/compute-scroll-split-path";

/**
 * Produce VaultAction[] to set or strip go-back links for all library md files
 * (codexes + scrolls). Uses goBackLinkHelper via existing transforms.
 *
 * @param tree - Tree reader (e.g. healer)
 * @param codecs - Codec API
 * @param rules - Codec rules (showScrollBacklinks, vault path scoping)
 */
export function getBacklinkHealingVaultActions(
	tree: TreeReader,
	codecs: Codecs,
	rules: CodecRules,
): VaultAction[] {
	const actions: VaultAction[] = [];
	const { sectionChains, scrollInfos } = collectTreeData(tree, codecs);

	// Non-root codexes: set first line to go-back link
	for (const chain of sectionChains) {
		if (chain.length <= 1) continue;
		const parentChain = chain.slice(0, -1);
		const splitPath = computeCodexSplitPath(chain, codecs);
		actions.push({
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: makeVaultScopedSplitPath(
					splitPath,
					rules,
				) as SplitPathToMdFile,
				transform: makeBacklinkTransform(parentChain, codecs),
			},
		});
	}

	// Scrolls: set or strip go-back link per rules.showScrollBacklinks
	for (const { nodeName, parentChain } of scrollInfos) {
		const splitPathResult = computeScrollSplitPath(
			nodeName,
			parentChain,
			codecs,
		);
		if (splitPathResult.isErr()) continue;
		const splitPath = splitPathResult.value;
		actions.push({
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: makeVaultScopedSplitPath(
					splitPath,
					rules,
				) as SplitPathToMdFile,
				transform: rules.showScrollBacklinks
					? makeBacklinkTransform(parentChain, codecs)
					: makeStripScrollBacklinkTransform(),
			},
		});
	}

	return actions;
}
