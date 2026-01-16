/**
 * Convert CodexImpact to CodexAction[].
 * Requires tree access to generate content.
 */

import { err, ok } from "neverthrow";
import {
	type BulkVaultEvent,
	VaultEventKind,
} from "../../../../../managers/obsidian/vault-action-manager";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { logger } from "../../../../../utils/logger";
import type { Codecs, SplitPathToMdFileInsideLibrary } from "../../../codecs";
import type { CodecError } from "../../../codecs/errors";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNode } from "../tree-node/types/tree-node";
import type { HealingAction } from "../types/healing-action";
import { computeScrollSplitPath } from "../utils/compute-scroll-split-path";
import { computeCodexSplitPath } from "./codex-split-path";
import type { CodexImpact } from "./compute-codex-impact";
import { isCodexSplitPath } from "./helpers";
import { CODEX_CORE_NAME } from "./literals";
import type {
	CodexAction,
	EnsureCodexFileExistsAction,
	ProcessCodexAction,
	ProcessScrollBacklinkAction,
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
 * Convert CodexImpact deletions to HealingAction[] (DeleteMdFile).
 * Handles deleted sections and renamed sections (old suffix at new location).
 *
 * @param impact - The codex impact from tree.apply()
 * @param tree - Tree accessor for section lookup (needed for descendant chains)
 * @param codecs - Codec API for parsing/constructing segment IDs
 */
export function codexImpactToDeletions(
	impact: CodexImpact,
	tree: TreeAccessor,
	codecs: Codecs,
): HealingAction[] {
	const actions: HealingAction[] = [];

	// 1. Handle deletes (sections that were deleted)
	for (const chain of impact.deleted) {
		const splitPath = computeCodexSplitPath(chain, codecs);
		const deleteAction: HealingAction = {
			kind: "DeleteMdFile",
			payload: { splitPath },
		};
		actions.push(deleteAction);
	}

	// 2. Handle old rename locations (delete moved codexes with old suffix)
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

		const deleteAction: HealingAction = {
			kind: "DeleteMdFile",
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
				const descDeleteAction: HealingAction = {
					kind: "DeleteMdFile",
					payload: { splitPath: movedDescPath },
				};
				actions.push(descDeleteAction);
			}
		}
	}

	return actions;
}

/**
 * Convert CodexImpact to CodexAction[] (recreations only).
 * Regenerates all codexes from current tree state (like init).
 * Handles WriteScrollStatus from impact.
 *
 * @param impact - The codex impact from tree.apply()
 * @param tree - Tree accessor for section lookup
 * @param codecs - Codec API for parsing/constructing segment IDs
 */
export function codexImpactToRecreations(
	impact: CodexImpact,
	tree: TreeAccessor,
	codecs: Codecs,
): CodexAction[] {
	const actions: CodexAction[] = [];

	// 1. Single traversal to collect all section chains AND all scrolls
	const { sectionChains, scrollInfos } = collectTreeData(tree, codecs);

	// 2. Generate codex actions for all sections (2 actions per codex)
	for (const chain of sectionChains) {
		const section = findSectionByChain(tree, chain);
		if (!section) continue;

		const splitPath = computeCodexSplitPath(chain, codecs);

		// 2a. Ensure codex file exists
		const ensureAction: EnsureCodexFileExistsAction = {
			kind: "EnsureCodexFileExists",
			payload: { splitPath },
		};
		actions.push(ensureAction);

		// 2b. Process codex (backlink + content combined)
		const processAction: ProcessCodexAction = {
			kind: "ProcessCodex",
			payload: { splitPath, section, sectionChain: chain },
		};
		actions.push(processAction);
	}

	// 3. Handle WriteScrollStatus for descendant scrolls
	for (const { sectionChain, newStatus } of impact.descendantsChanged) {
		const section = findSectionByChain(tree, sectionChain);
		if (!section) continue;

		// Collect all descendant scrolls for status writes
		const descendantScrolls = collectDescendantScrolls(
			section,
			sectionChain,
		);
		for (const { nodeName, parentChain } of descendantScrolls) {
			const splitPathResult = computeScrollSplitPath(
				nodeName,
				parentChain,
				codecs,
			);
			if (splitPathResult.isErr()) {
				logger.warn(
					"[Codex] Failed to compute scroll split path:",
					splitPathResult.error,
				);
				continue; // Maintain current behavior: skip on error
			}
			const splitPath = splitPathResult.value;

			const writeStatusAction: WriteScrollStatusAction = {
				kind: "WriteScrollStatus",
				payload: { splitPath, status: newStatus },
			};
			actions.push(writeStatusAction);
		}
	}

	// 4. Generate scroll backlink actions for ALL scrolls in the tree
	// (Already collected in single traversal above)
	for (const { nodeName, parentChain } of scrollInfos) {
		const splitPathResult = computeScrollSplitPath(
			nodeName,
			parentChain,
			codecs,
		);
		if (splitPathResult.isErr()) {
			logger.warn(
				"[Codex] Failed to compute scroll split path for backlink:",
				splitPathResult.error,
			);
			continue;
		}
		const splitPath = splitPathResult.value;

		const scrollBacklinkAction: ProcessScrollBacklinkAction = {
			kind: "ProcessScrollBacklink",
			payload: { splitPath, parentChain },
		};
		actions.push(scrollBacklinkAction);
	}

	return actions;
}

/**
 * Convert CodexImpact to CodexAction[] (incremental recreations).
 * Only processes impacted sections from impact.impactedChains - O(k) instead of O(n).
 * Use this for event-driven updates; use codexImpactToRecreations for full init.
 *
 * @param impact - The codex impact from tree.apply()
 * @param tree - Tree accessor for section lookup
 * @param codecs - Codec API for parsing/constructing segment IDs
 */
export function codexImpactToIncrementalRecreations(
	impact: CodexImpact,
	tree: TreeAccessor,
	codecs: Codecs,
): CodexAction[] {
	const actions: CodexAction[] = [];

	// 1. Convert impactedChains Set to actual chains and process only those
	for (const chainKey of impact.impactedChains) {
		const chain = chainKey.split("/") as SectionNodeSegmentId[];
		const section = findSectionByChain(tree, chain);
		if (!section) continue;

		const splitPath = computeCodexSplitPath(chain, codecs);

		// 1a. Ensure codex file exists
		const ensureAction: EnsureCodexFileExistsAction = {
			kind: "EnsureCodexFileExists",
			payload: { splitPath },
		};
		actions.push(ensureAction);

		// 1b. Process codex (backlink + content combined)
		const processAction: ProcessCodexAction = {
			kind: "ProcessCodex",
			payload: { splitPath, section, sectionChain: chain },
		};
		actions.push(processAction);

		// 1c. Generate scroll backlink actions for scrolls in this section (direct children only)
		for (const [_segId, child] of Object.entries(section.children)) {
			if (child.kind === TreeNodeKind.Scroll) {
				const splitPathResult = computeScrollSplitPath(
					child.nodeName,
					chain,
					codecs,
				);
				if (splitPathResult.isErr()) {
					logger.warn(
						"[Codex] Failed to compute scroll split path for backlink:",
						splitPathResult.error,
					);
					continue;
				}

				const scrollBacklinkAction: ProcessScrollBacklinkAction = {
					kind: "ProcessScrollBacklink",
					payload: {
						splitPath: splitPathResult.value,
						parentChain: chain,
					},
				};
				actions.push(scrollBacklinkAction);
			}
		}
	}

	// 2. Handle WriteScrollStatus for descendant scrolls
	for (const { sectionChain, newStatus } of impact.descendantsChanged) {
		const section = findSectionByChain(tree, sectionChain);
		if (!section) continue;

		const descendantScrolls = collectDescendantScrolls(
			section,
			sectionChain,
		);
		for (const { nodeName, parentChain } of descendantScrolls) {
			const splitPathResult = computeScrollSplitPath(
				nodeName,
				parentChain,
				codecs,
			);
			if (splitPathResult.isErr()) {
				logger.warn(
					"[Codex] Failed to compute scroll split path:",
					splitPathResult.error,
				);
				continue;
			}

			const writeStatusAction: WriteScrollStatusAction = {
				kind: "WriteScrollStatus",
				payload: {
					splitPath: splitPathResult.value,
					status: newStatus,
				},
			};
			actions.push(writeStatusAction);
		}
	}

	return actions;
}

/**
 * Extract invalid codex files from bulk events and return deletion actions.
 * Detects codexes with wrong suffixes (e.g., from folder duplicates, moves, renames).
 *
 * @param bulkEvent - The bulk vault event containing FileCreated/FileRenamed events
 * @param codecs - Codec API for parsing/constructing segment IDs
 * @returns Array of deletion actions for invalid codexes
 */
export function extractInvalidCodexesFromBulk(
	bulkEvent: BulkVaultEvent,
	codecs: Codecs,
): HealingAction[] {
	const actions: HealingAction[] = [];

	for (const event of bulkEvent.events) {
		// Check FileCreated events
		if (event.kind === VaultEventKind.FileCreated) {
			if (event.splitPath.kind !== SplitPathKind.MdFile) continue;
			if (!isCodexSplitPath(event.splitPath, codecs)) continue;

			const invalidAction = validateCodexSplitPath(
				event.splitPath,
				codecs,
			);
			if (invalidAction) {
				actions.push(invalidAction);
			}
		}

		// Check FileRenamed events (only "to" path)
		if (event.kind === VaultEventKind.FileRenamed) {
			if (event.to.kind !== SplitPathKind.MdFile) continue;
			if (!isCodexSplitPath(event.to, codecs)) continue;

			const invalidAction = validateCodexSplitPath(event.to, codecs);
			if (invalidAction) {
				actions.push(invalidAction);
			}
		}
	}

	return actions;
}

/**
 * Validate a codex split path by comparing observed basename with expected basename.
 * Returns deletion action if mismatch, null if valid or on parse error.
 */
function validateCodexSplitPath(
	splitPath: SplitPathToMdFileInsideLibrary,
	codecs: Codecs,
): HealingAction | null {
	// Build section chain from pathParts
	const sectionChainResult = buildSectionChainFromPathParts(
		splitPath.pathParts,
		codecs,
	);
	if (sectionChainResult.isErr()) {
		// Skip on parse error
		return null;
	}
	const sectionChain = sectionChainResult.value;

	// Compute expected codex basename for this section chain
	const expectedSplitPath = computeCodexSplitPath(sectionChain, codecs);

	// Compare observed vs expected basename
	if (splitPath.basename !== expectedSplitPath.basename) {
		// Mismatch: return deletion action
		return {
			kind: "DeleteMdFile",
			payload: { splitPath },
		};
	}

	// Valid: no action needed
	return null;
}

/**
 * Build section chain (segment IDs) from path parts (node names).
 * Returns Result to handle parse errors gracefully.
 */
function buildSectionChainFromPathParts(
	pathParts: string[],
	codecs: Codecs,
): import("neverthrow").Result<SectionNodeSegmentId[], CodecError> {
	const sectionChain: SectionNodeSegmentId[] = [];

	for (const nodeName of pathParts) {
		const segIdResult = codecs.segmentId.serializeSegmentIdUnchecked({
			coreName: nodeName,
			targetKind: TreeNodeKind.Section,
		});
		if (segIdResult.isErr()) {
			return err(segIdResult.error);
		}
		sectionChain.push(segIdResult.value as SectionNodeSegmentId);
	}

	return ok(sectionChain);
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

// ─── Unified Tree Traversal ───

type TreeTraversalResult = {
	sectionChains: SectionNodeSegmentId[][];
	scrollInfos: ScrollInfo[];
};

/**
 * Single DFS traversal collecting both section chains and scroll infos.
 * More efficient than separate collectAllSectionChains + collectAllScrolls.
 */
function collectTreeData(
	tree: TreeAccessor,
	codecs: Codecs,
): TreeTraversalResult {
	const sectionChains: SectionNodeSegmentId[][] = [];
	const scrollInfos: ScrollInfo[] = [];

	const root = tree.getRoot();
	const rootSegId = codecs.segmentId.serializeSegmentId({
		coreName: root.nodeName,
		targetKind: TreeNodeKind.Section,
	}) as SectionNodeSegmentId;

	// Add root chain
	sectionChains.push([rootSegId]);

	// Single recursive traversal collecting both
	const traverse = (
		section: SectionNode,
		parentChain: SectionNodeSegmentId[],
	): void => {
		for (const [segId, child] of Object.entries(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
				const childChain = [
					...parentChain,
					segId as SectionNodeSegmentId,
				];
				sectionChains.push(childChain);
				traverse(child, childChain);
			} else if (child.kind === TreeNodeKind.Scroll) {
				scrollInfos.push({
					nodeName: child.nodeName,
					parentChain,
				});
			}
		}
	};

	traverse(root, [rootSegId]);
	return { sectionChains, scrollInfos };
}

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

	const basename = codecs.suffix.serializeSeparatedSuffix({
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
