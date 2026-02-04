/**
 * Singular backlink healing: set or strip go-back links for all library md files.
 * Runs on init and on rename/move; uses only goBackLinkHelper for link building.
 */

import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager/types/vault-action";
import type { Codecs } from "../../codecs";
import type { CodecRules } from "../../codecs/rules";
import { computeCodexSplitPath } from "../library-tree/codex/codex-split-path";
import {
	makeBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "../library-tree/codex/transforms/scroll-transforms";
import { collectTreeData } from "../library-tree/codex/tree-collectors";
import { makeVaultScopedSplitPath } from "../library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { TreeReader } from "../library-tree/tree-interfaces";
import { computeScrollSplitPath } from "../library-tree/utils/compute-scroll-split-path";

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
