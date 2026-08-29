/**
 * Singular backlink healing: set or strip go-back links for all library md files.
 * Runs on init and on rename/move; uses only goBackLinkHelper for link building.
 */

import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import type { Codecs } from "../codecs";
import {
	collectTreeData,
	computeCodexSplitPath,
	makeBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "../codex";
import type { TreeReader } from "../tree";
import { makeLibraryScope } from "../tree/library-scope";
import { computeScrollSplitPath } from "../tree/utils";

/**
 * Produce VaultAction[] to set or strip go-back links for all library md files
 * (codexes + scrolls). Uses goBackLinkHelper via existing transforms.
 *
 * @param tree - Tree reader (e.g. healer)
 * @param codecs - Codec API
 */
export function getBacklinkHealingVaultActions(
	tree: TreeReader,
	codecs: Codecs,
): VaultAction[] {
	const actions: VaultAction[] = [];
	const { rules } = codecs;
	const libraryScope = makeLibraryScope(rules);
	const { sectionChains, scrollInfos } = collectTreeData(tree, codecs);

	// Non-root codexes: set first line to go-back link
	for (const chain of sectionChains) {
		if (chain.length <= 1) continue;
		const parentChain = chain.slice(0, -1);
		const splitPath = computeCodexSplitPath(chain, codecs);
		actions.push({
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: libraryScope.toVaultPath(splitPath),
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
				splitPath: libraryScope.toVaultPath(splitPath),
				transform: rules.showScrollBacklinks
					? makeBacklinkTransform(parentChain, codecs)
					: makeStripScrollBacklinkTransform(),
			},
		});
	}

	return actions;
}
