/**
 * Convert CodexImpact to CodexAction[].
 * Requires tree access to generate content.
 */

import { SplitPathType } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { SplitPathToMdFileInsideLibrary } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import {
	makeJoinedSuffixedBasename,
	makeSuffixPartsFromPathPartsWithRoot,
} from "../tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { TreeNodeType } from "../tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator } from "../tree-node/types/node-segment-id";
import type { ScrollNode, SectionNode } from "../tree-node/types/tree-node";
import { computeCodexSplitPath } from "./codex-split-path";
import type { CodexImpact } from "./compute-codex-impact";
import { generateCodexContent } from "./generate-codex-content";
import type {
	CodexAction,
	CreateCodexAction,
	DeleteCodexAction,
	RenameCodexAction,
	UpdateCodexAction,
	WriteScrollStatusAction,
} from "./types/codex-action";

// ─── Types ───

export type TreeAccessor = {
	/** Find section by chain. Returns undefined if not found. */
	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined;
	/** Get root section */
	getRoot(): SectionNode;
};

// ─── Main ───

/**
 * Convert CodexImpact to CodexAction[].
 *
 * @param impact - The codex impact from tree.apply()
 * @param tree - Tree accessor for section lookup
 * @param isInit - If true, emit CreateCodex instead of UpdateCodex for new sections
 */
export function codexImpactToActions(
	impact: CodexImpact,
	tree: TreeAccessor,
	isInit = false,
): CodexAction[] {
	const actions: CodexAction[] = [];

	// 1. Handle renames first (before content updates)
	// Note: For section renames, Obsidian moves the folder contents automatically.
	// We need to rename the section's codex AND all descendant codexes.
	for (const { oldChain, newChain } of impact.renamed) {
		// Find section in tree (using new chain since tree is already updated)
		const section = findSectionByChain(tree, newChain);
		
		// Collect all rename pairs: [oldChain, newChain] for section + descendants
		const renamePairs = collectCodexRenamePairs(
			oldChain,
			newChain,
			section,
		);

		for (const { fromOldChain, toNewChain } of renamePairs) {
			const renameAction = buildCodexRenameAction(fromOldChain, toNewChain);
			actions.push(renameAction);
		}
	}

	// 2. Handle deletes
	for (const chain of impact.deleted) {
		const splitPath = computeCodexSplitPath(chain);

		const deleteAction: DeleteCodexAction = {
			payload: { splitPath },
			type: "DeleteCodex",
		};
		actions.push(deleteAction);
	}

	// 3. Handle content changes (create or update)
	// Dedupe chains that were already renamed (use new chain)
	const renamedNewChains = new Set(
		impact.renamed.map((r) => chainToKey(r.newChain)),
	);
	const deletedChains = new Set(impact.deleted.map(chainToKey));

	for (const chain of impact.contentChanged) {
		const chainKey = chainToKey(chain);

		// Skip if deleted
		if (deletedChains.has(chainKey)) continue;

		// Find section in tree
		const section = findSectionByChain(tree, chain);
		if (!section) continue;

		// Generate content
		const content = generateCodexContent(section, chain);
		const splitPath = computeCodexSplitPath(chain);

		// Determine if create or update
		// - isInit + new section = CreateCodex
		// - Otherwise = UpdateCodex
		const actionType: "CreateCodex" | "UpdateCodex" =
			isInit && !renamedNewChains.has(chainKey)
				? "CreateCodex"
				: "UpdateCodex";

		const upsertAction: CreateCodexAction | UpdateCodexAction = {
			payload: { content, sectionChain: chain, splitPath },
			type: actionType,
		};
		actions.push(upsertAction);
	}

	// 4. Handle descendantsChanged (for ChangeStatus on section)
	// These sections need their content regenerated + scrolls need status written
	for (const { sectionChain, newStatus } of impact.descendantsChanged) {
		const section = findSectionByChain(tree, sectionChain);
		if (!section) continue;

		// Collect all descendant sections for codex updates
		const descendantChains = collectDescendantSectionChains(
			section,
			sectionChain,
		);
		for (const descChain of descendantChains) {
			const descSection = findSectionByChain(tree, descChain);
			if (!descSection) continue;

			const content = generateCodexContent(descSection, descChain);
			const splitPath = computeCodexSplitPath(descChain);

			const updateAction: UpdateCodexAction = {
				payload: { content, sectionChain: descChain, splitPath },
				type: "UpdateCodex",
			};
			actions.push(updateAction);
		}

		// Collect all descendant scrolls for status writes
		const scrollInfos = collectDescendantScrolls(section, sectionChain);
		for (const { nodeName, parentChain } of scrollInfos) {
			const splitPath = computeScrollSplitPath(nodeName, parentChain);

			const writeStatusAction: WriteScrollStatusAction = {
				payload: { splitPath, status: newStatus },
				type: "WriteScrollStatus",
			};
			actions.push(writeStatusAction);
		}
	}

	return actions;
}

// ─── Helpers ───

function chainToKey(chain: SectionNodeSegmentId[]): string {
	return chain.join("/");
}

function findSectionByChain(
	tree: TreeAccessor,
	chain: SectionNodeSegmentId[],
): SectionNode | undefined {
	if (chain.length === 0) return undefined;
	if (chain.length === 1) return tree.getRoot();
	return tree.findSection(chain);
}

function collectDescendantSectionChains(
	section: SectionNode,
	parentChain: SectionNodeSegmentId[],
): SectionNodeSegmentId[][] {
	const result: SectionNodeSegmentId[][] = [];

	for (const [segId, child] of Object.entries(section.children)) {
		if (child.type === TreeNodeType.Section) {
			const childChain = [...parentChain, segId as SectionNodeSegmentId];
			result.push(childChain);
			result.push(...collectDescendantSectionChains(child, childChain));
		}
	}

	return result;
}

type ScrollInfo = {
	nodeName: string;
	parentChain: SectionNodeSegmentId[];
};

function collectDescendantScrolls(
	section: SectionNode,
	parentChain: SectionNodeSegmentId[],
): ScrollInfo[] {
	const result: ScrollInfo[] = [];

	for (const [segId, child] of Object.entries(section.children)) {
		if (child.type === TreeNodeType.Scroll) {
			result.push({
				nodeName: child.nodeName,
				parentChain,
			});
		} else if (child.type === TreeNodeType.Section) {
			const childChain = [...parentChain, segId as SectionNodeSegmentId];
			result.push(...collectDescendantScrolls(child, childChain));
		}
	}

	return result;
}

function computeScrollSplitPath(
	nodeName: string,
	parentChain: SectionNodeSegmentId[],
): SplitPathToMdFileInsideLibrary {
	const pathParts = parentChain.map(extractNodeNameFromSegmentId);
	const suffixParts = makeSuffixPartsFromPathPartsWithRoot(pathParts);

	const basename = makeJoinedSuffixedBasename({
		coreName: nodeName,
		suffixParts,
	});

	return {
		basename,
		extension: "md",
		pathParts,
		type: SplitPathType.MdFile,
	};
}

function extractNodeNameFromSegmentId(segId: SectionNodeSegmentId): string {
	const sep = NodeSegmentIdSeparator;
	const [raw] = segId.split(sep, 1);
	return raw ?? "";
}

// ─── Codex Rename Helpers ───

type RenamePair = {
	fromOldChain: SectionNodeSegmentId[];
	toNewChain: SectionNodeSegmentId[];
};

/**
 * Collect all codex rename pairs for a section rename.
 * Includes the renamed section itself + all descendant sections.
 */
function collectCodexRenamePairs(
	oldChain: SectionNodeSegmentId[],
	newChain: SectionNodeSegmentId[],
	section: SectionNode | undefined,
): RenamePair[] {
	const pairs: RenamePair[] = [];

	// Add the renamed section itself
	pairs.push({ fromOldChain: oldChain, toNewChain: newChain });

	// Add all descendant sections
	if (section) {
		const descendants = collectDescendantRenamePairs(
			section,
			oldChain,
			newChain,
		);
		pairs.push(...descendants);
	}

	return pairs;
}

/**
 * Recursively collect rename pairs for descendant sections.
 */
function collectDescendantRenamePairs(
	section: SectionNode,
	oldParentChain: SectionNodeSegmentId[],
	newParentChain: SectionNodeSegmentId[],
): RenamePair[] {
	const pairs: RenamePair[] = [];

	for (const [segId, child] of Object.entries(section.children)) {
		if (child.type === TreeNodeType.Section) {
			const childSegId = segId as SectionNodeSegmentId;
			const childOldChain = [...oldParentChain, childSegId];
			const childNewChain = [...newParentChain, childSegId];

			pairs.push({ fromOldChain: childOldChain, toNewChain: childNewChain });

			// Recurse
			pairs.push(
				...collectDescendantRenamePairs(child, childOldChain, childNewChain),
			);
		}
	}

	return pairs;
}

/**
 * Build a RenameCodex action from old and new chains.
 * Handles the fact that Obsidian moved files to new folder path.
 */
function buildCodexRenameAction(
	oldChain: SectionNodeSegmentId[],
	newChain: SectionNodeSegmentId[],
): RenameCodexAction {
	// After folder rename, Obsidian moved files to new path but kept old basename.
	// So "from" path = new folder path + old basename
	const fromPathParts = newChain.map(extractNodeNameFromSegmentId);

	// Old basename suffix (what the file WAS named)
	const oldSuffixParts =
		oldChain.length === 1
			? [extractNodeNameFromSegmentId(oldChain[0]!)]
			: oldChain.slice(1).map(extractNodeNameFromSegmentId).reverse();

	const fromPath: SplitPathToMdFileInsideLibrary = {
		basename: makeJoinedSuffixedBasename({
			coreName: "__",
			suffixParts: oldSuffixParts,
		}),
		extension: "md",
		pathParts: fromPathParts,
		type: SplitPathType.MdFile,
	};

	const toPath = computeCodexSplitPath(newChain);

	return {
		payload: { from: fromPath, to: toPath },
		type: "RenameCodex",
	};
}
