/**
 * Convert CodexImpact to CodexAction[].
 * Requires tree access to generate content.
 */

import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Codecs } from "../../../codecs";
import type { SplitPathToMdFileInsideLibrary } from "../../../codecs/split-path-inside-library/types/generic-split-path-inside-library-of";
import {
	makeJoinedSuffixedBasename,
	makeSuffixPartsFromPathPartsWithRoot,
} from "../tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../tree-node/types/node-segment-id";
import type { SectionNode } from "../tree-node/types/tree-node";
import { computeCodexSplitPath } from "./codex-split-path";
import type { CodexImpact } from "./compute-codex-impact";
import { generateCodexContent } from "./generate-codex-content";
import { CODEX_CORE_NAME } from "./literals";
import type {
	CodexAction,
	DeleteCodexAction,
	UpsertCodexAction,
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
 * Regenerates all codexes from current tree state (like init).
 * Handles deletes and WriteScrollStatus from impact.
 *
 * @param impact - The codex impact from tree.apply()
 * @param tree - Tree accessor for section lookup
 * @param codecs - Codec API for parsing/constructing segment IDs
 */
export function codexImpactToActions(
	impact: CodexImpact,
	tree: TreeAccessor,
	codecs: Codecs,
): CodexAction[] {
	const actions: CodexAction[] = [];

	// 1. Collect ALL section chains from current tree state
	// This ensures we regenerate all codexes, not just "touched" ones
	const allSectionChains = collectAllSectionChains(tree, codecs);

	// 2. Generate UpsertCodex for all sections
	for (const chain of allSectionChains) {
		const section = findSectionByChain(tree, chain);
		if (!section) continue;

		const content = generateCodexContent(section, chain, codecs);
		const splitPath = computeCodexSplitPath(chain, codecs);

		const upsertAction: UpsertCodexAction = {
			kind: "UpsertCodex",
			payload: { content, sectionChain: chain, splitPath },
		};
		actions.push(upsertAction);
	}

	// 3. Handle deletes (sections that were deleted)
	for (const chain of impact.deleted) {
		const splitPath = computeCodexSplitPath(chain, codecs);
		const deleteAction: DeleteCodexAction = {
			kind: "DeleteCodex",
			payload: { splitPath },
		};
		actions.push(deleteAction);
	}

	// 4. Handle old rename locations (delete moved codexes with old suffix)
	// When Obsidian moves a folder, it moves all files inside, including codexes.
	// So the old codex file is now at the NEW location but with the OLD suffix.
	// Example: kid2 moved from dad to mom:
	// - Old: Library/dad/kid2/__-kid2-dad.md
	// - After Obsidian move: Library/mom/kid2/__-kid2-dad.md (moved with folder)
	// - We want: Library/mom/kid2/__-kid2-mom.md (new canonical)
	// - So we delete: Library/mom/kid2/__-kid2-dad.md (new location, old suffix)
	for (const { oldChain, newChain } of impact.renamed) {
		// Delete the moved codex at NEW location with OLD suffix
		const movedCodexPath = buildMovedCodexPath(oldChain, newChain, codecs);

		const deleteAction: DeleteCodexAction = {
			kind: "DeleteCodex",
			payload: { splitPath: movedCodexPath },
		};
		actions.push(deleteAction);

		// For descendants, we need to delete their moved codexes too
		const section = findSectionByChain(tree, newChain);
		if (section) {
			const newDescendantChains = collectDescendantSectionChains(
				section,
				newChain,
			);
			// Map new descendant chains back to old chains for suffix computation
			for (const newDescChain of newDescendantChains) {
				const relativePath = newDescChain.slice(newChain.length);
				const oldDescChain = [...oldChain, ...relativePath];
				// Build path: new location (newDescChain) with old suffix (oldDescChain)
				const movedDescPath = buildMovedCodexPath(
					oldDescChain,
					newDescChain,
					codecs,
				);
				const descDeleteAction: DeleteCodexAction = {
					kind: "DeleteCodex",
					payload: { splitPath: movedDescPath },
				};
				actions.push(descDeleteAction);
			}
		}
	}

	// 5. Handle WriteScrollStatus for descendant scrolls
	for (const { sectionChain, newStatus } of impact.descendantsChanged) {
		const section = findSectionByChain(tree, sectionChain);
		if (!section) continue;

		// Collect all descendant scrolls for status writes
		const scrollInfos = collectDescendantScrolls(section, sectionChain);
		for (const { nodeName, parentChain } of scrollInfos) {
			const splitPath = computeScrollSplitPath(
				nodeName,
				parentChain,
				codecs,
			);

			const writeStatusAction: WriteScrollStatusAction = {
				kind: "WriteScrollStatus",
				payload: { splitPath, status: newStatus },
			};
			actions.push(writeStatusAction);
		}
	}

	return actions;
}

// ─── Helpers ───

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
		if (child.kind === TreeNodeKind.Section) {
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
		if (child.kind === TreeNodeKind.Scroll) {
			result.push({
				nodeName: child.nodeName,
				parentChain,
			});
		} else if (child.kind === TreeNodeKind.Section) {
			const childChain = [...parentChain, segId as SectionNodeSegmentId];
			result.push(...collectDescendantScrolls(child, childChain));
		}
	}

	return result;
}

function computeScrollSplitPath(
	nodeName: string,
	parentChain: SectionNodeSegmentId[],
	codecs: Codecs,
): SplitPathToMdFileInsideLibrary {
	// Extract path parts from parent chain using codec API
	const pathParts: string[] = [];
	for (const segId of parentChain) {
		const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			// Skip this scroll if parsing fails (should never happen with valid tree state)
			continue;
		}
		pathParts.push(parseResult.value.coreName);
	}
	const suffixParts = makeSuffixPartsFromPathPartsWithRoot(pathParts);

	const basename = makeJoinedSuffixedBasename({
		coreName: nodeName,
		suffixParts,
	});

	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

/**
 * Collect all section chains from the tree (including root).
 * Similar to init regeneration - collects all sections recursively.
 */
function collectAllSectionChains(
	tree: TreeAccessor,
	codecs: Codecs,
): SectionNodeSegmentId[][] {
	const chains: SectionNodeSegmentId[][] = [];
	const root = tree.getRoot();

	// Root section chain is just the root segment ID
	// Use codec API to serialize segment ID from TreeNode
	const rootSegId = codecs.segmentId.serializeSegmentId({
		coreName: root.nodeName,
		targetKind: TreeNodeKind.Section,
	}) as SectionNodeSegmentId;
	chains.push([rootSegId]);

	// Recursively collect all descendant sections
	const collectRecursive = (
		section: SectionNode,
		parentChain: SectionNodeSegmentId[],
	): void => {
		for (const [segId, child] of Object.entries(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
				const childChain = [
					...parentChain,
					segId as SectionNodeSegmentId,
				];
				chains.push(childChain);
				collectRecursive(child, childChain);
			}
		}
	};

	collectRecursive(root, [rootSegId]);
	return chains;
}

/**
 * Build path for a codex file that was moved by Obsidian.
 * The file is at the NEW location but has the OLD suffix.
 *
 * @param oldChain - Old section chain (for computing old suffix)
 * @param newChain - New section chain (for computing new pathParts)
 * @param codecs - Codec API for parsing segment IDs
 * @returns Split path for the moved codex file
 *
 * Example: kid2 moved from dad to mom
 * - oldChain: [Library, dad, kid2] → suffix: ["kid2", "dad"]
 * - newChain: [Library, mom, kid2] → pathParts: ["Library", "mom", "kid2"]
 * - Result: { pathParts: ["Library", "mom", "kid2"], basename: "__-kid2-dad" }
 */
function buildMovedCodexPath(
	oldChain: SectionNodeSegmentId[],
	newChain: SectionNodeSegmentId[],
	codecs: Codecs,
): SplitPathToMdFileInsideLibrary {
	// Extract node names using codec API
	const oldNodeNames: string[] = [];
	for (const segId of oldChain) {
		const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			// Skip if parsing fails (should never happen with valid tree state)
			continue;
		}
		oldNodeNames.push(parseResult.value.coreName);
	}

	const newNodeNames: string[] = [];
	for (const segId of newChain) {
		const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			// Skip if parsing fails (should never happen with valid tree state)
			continue;
		}
		newNodeNames.push(parseResult.value.coreName);
	}

	// pathParts = NEW location (where file is now)
	const pathParts = newNodeNames;

	// suffixParts = OLD suffix (what the file was named before)
	// Same logic as computeCodexSplitPath
	const suffixParts =
		oldNodeNames.length === 1
			? oldNodeNames // Root: ["Library"]
			: oldNodeNames.slice(1).reverse(); // Nested: exclude root, reverse

	const basename = makeJoinedSuffixedBasename({
		coreName: CODEX_CORE_NAME,
		suffixParts,
	});

	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}
