/**
 * Scroll backlink healing for startup and bounded runtime changes.
 */

import {
	MD,
	SplitPathKind,
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import type { Codecs } from "../codecs";
import {
	collectDescendantScrolls,
	collectTreeData,
	makeBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "../codex";
import { TreeNodeKind, type TreeReader } from "../tree";
import { makeLibraryScope } from "../tree/library-scope";
import { computeScrollSplitPath } from "../tree/utils";
import type { HealerApplyResult } from "./healer";

/**
 * Produce the startup backlink pass for all library Markdown files. Runtime
 * Codex transforms already own their complete content, including backlinks;
 * this pass remains useful for repairing pre-existing Scroll content.
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
	const { scrollInfos } = collectTreeData(tree, codecs);

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

/**
 * Produce only the Scroll backlink work caused by changed runtime Tree Actions.
 *
 * Status changes never alter paths and therefore produce no backlink work.
 * Creates touch the new Scroll. Moves and Section renames touch only the moved
 * subtree whose paths or parent links may have changed. Codex backlinks belong
 * to the complete ProcessCodex projection.
 */
export function getIncrementalBacklinkHealingVaultActions(
	stagedTree: TreeReader,
	results: readonly HealerApplyResult[],
	codecs: Codecs,
): VaultAction[] {
	const actions = new Map<string, VaultAction>();
	const libraryScope = makeLibraryScope(codecs.rules);

	const addScroll = (
		nodeName: string,
		parentChain: Parameters<typeof computeScrollSplitPath>[1],
	): void => {
		const segmentId = codecs.segmentId.serializeSegmentId({
			coreName: nodeName,
			extension: MD,
			targetKind: TreeNodeKind.Scroll,
		});
		const finalNode =
			stagedTree.findSection(parentChain)?.children[segmentId];
		if (finalNode?.kind !== TreeNodeKind.Scroll) return;

		const splitPath = computeScrollSplitPath(nodeName, parentChain, codecs);
		if (splitPath.isErr()) return;
		const vaultPath = libraryScope.toVaultPath(splitPath.value);
		actions.set(`scroll:${parentChain.join("/")}/${nodeName}`, {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: vaultPath,
				transform: codecs.rules.showScrollBacklinks
					? makeBacklinkTransform(parentChain, codecs)
					: makeStripScrollBacklinkTransform(),
			},
		});
	};

	for (const result of results) {
		if (!result.changed) continue;
		const action = result.appliedAction;

		switch (action.actionType) {
			case "ChangeStatus":
			case "Delete":
				break;

			case "Rename":
				if (action.targetLocator.targetKind === "Scroll") {
					addScroll(
						action.newNodeName,
						action.targetLocator.segmentIdChainToParent,
					);
				}
				break;

			case "Create": {
				if (action.observedSplitPath.kind === SplitPathKind.MdFile) {
					const parsed = codecs.segmentId.parseSegmentId(
						action.targetLocator.segmentId,
					);
					if (parsed.isOk()) {
						addScroll(
							parsed.value.coreName,
							action.targetLocator.segmentIdChainToParent,
						);
					}
				}
				break;
			}

			case "Move": {
				if (action.targetLocator.targetKind !== "Section") {
					if (
						action.observedSplitPath.kind === SplitPathKind.MdFile
					) {
						addScroll(action.newNodeName, [
							...action.newParentLocator.segmentIdChainToParent,
							action.newParentLocator.segmentId,
						]);
					}
					break;
				}
				break;
			}
		}

		for (const { newChain } of result.codexImpact.renamed) {
			const section = stagedTree.findSection(newChain);
			if (!section) continue;
			for (const scroll of collectDescendantScrolls(section, newChain)) {
				addScroll(scroll.nodeName, scroll.parentChain);
			}
		}
	}

	return [...actions.values()];
}
