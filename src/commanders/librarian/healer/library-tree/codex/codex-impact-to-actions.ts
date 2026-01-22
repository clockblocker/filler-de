/**
 * Convert CodexImpact to CodexAction[].
 * Requires tree access to generate content.
 */

import { err, ok } from "neverthrow";
import {
	type BulkVaultEvent,
	VaultEventKind,
} from "../../../../../managers/obsidian/vault-action-manager";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { logger } from "../../../../../utils/logger";
import type { Codecs, SplitPathToMdFileInsideLibrary } from "../../../codecs";
import type { CodecError } from "../../../codecs/errors";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import {
	computeCodexSuffix,
	parseSectionChainToNodeNames,
} from "../../../paths/path-finder";
import type { TreeReader } from "../tree-interfaces";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNode } from "../tree-node/types/tree-node";
import type { HealingAction } from "../types/healing-action";
import { computeScrollSplitPath } from "../utils/compute-scroll-split-path";
import { computeCodexSplitPath } from "./codex-split-path";
import type { CodexImpact } from "./compute-codex-impact";
import { isCodexSplitPath } from "./helpers";
import { CODEX_CORE_NAME } from "./literals";
import {
	collectDescendantScrolls,
	collectDescendantSectionChains,
	collectTreeData,
} from "./tree-collectors";
import type {
	CodexAction,
	EnsureCodexFileExistsAction,
	ProcessCodexAction,
	ProcessScrollBacklinkAction,
	WriteScrollStatusAction,
} from "./types/codex-action";

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
	tree: TreeReader,
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
	//
	// IMPORTANT: For Move actions (where observedPathParts is set), we need to
	// delete at the INTERMEDIATE location (where Obsidian actually moved the folder),
	// not the final location (where our healing folder move will put it).
	// This is because delete actions execute BEFORE folder move actions in dispatch.
	for (const { oldChain, newChain, observedPathParts } of impact.renamed) {
		// For Move: use observedPathParts (intermediate location) with old suffix
		// For Rename: use newChain (final location) with old suffix (no intermediate state)
		const movedCodexPath = observedPathParts
			? buildIntermediateCodexPath(oldChain, observedPathParts, codecs)
			: buildMovedCodexPath(oldChain, newChain, codecs);

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

				// For Move: compute intermediate path for descendant
				// For Rename: use final path (no intermediate state)
				let movedDescPath: SplitPathToMdFileInsideLibrary;
				if (observedPathParts) {
					// Extract node names from relative path segments for intermediate path
					const relativeNodeNames = extractNodeNamesFromChain(
						relativePath,
						codecs,
					);
					const descObservedPathParts = [
						...observedPathParts,
						...relativeNodeNames,
					];
					movedDescPath = buildIntermediateCodexPath(
						oldDescChain,
						descObservedPathParts,
						codecs,
					);
				} else {
					movedDescPath = buildMovedCodexPath(
						oldDescChain,
						newDescChain,
						codecs,
					);
				}

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
	tree: TreeReader,
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
			payload: { section, sectionChain: chain, splitPath },
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
			payload: { parentChain, splitPath },
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
	tree: TreeReader,
	codecs: Codecs,
): CodexAction[] {
	const actions: CodexAction[] = [];

	logger.info(
		"[Codex] impactedChains:",
		JSON.stringify([...impact.impactedChains]),
	);

	// 1. Convert impactedChains Set to actual chains and process only those
	for (const chainKey of impact.impactedChains) {
		const chain = chainKey.split("/") as SectionNodeSegmentId[];
		const section = findSectionByChain(tree, chain);
		logger.info(
			"[Codex] Chain lookup:",
			JSON.stringify({ chainKey, found: !!section }),
		);

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
			payload: { section, sectionChain: chain, splitPath },
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
						parentChain: chain,
						splitPath: splitPathResult.value,
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
			if (!isCodexSplitPath(event.splitPath)) continue;

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
			if (!isCodexSplitPath(event.to)) continue;

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
	tree: TreeReader,
	chain: SectionNodeSegmentId[],
): SectionNode | undefined {
	if (chain.length === 0) return undefined;
	if (chain.length === 1) return tree.getRoot();
	return tree.findSection(chain);
}

/**
 * Extract node names from a chain of segment IDs.
 * Wrapper around PathFinder.parseSectionChainToNodeNames that returns empty array on error.
 */
function extractNodeNamesFromChain(
	chain: SectionNodeSegmentId[],
	codecs: Codecs,
): string[] {
	const result = parseSectionChainToNodeNames(chain, codecs);
	return result.isOk() ? result.value : [];
}

// Tree traversal functions moved to tree-collectors.ts

/**
 * Build path for a codex file at an INTERMEDIATE location.
 * Used for Move actions where Obsidian has moved the folder but our healing
 * folder rename hasn't executed yet.
 *
 * @param oldChain - Old section chain (for computing old suffix)
 * @param observedPathParts - The intermediate location (where Obsidian moved the folder)
 * @param codecs - Codec API for parsing segment IDs
 * @returns Split path for the codex file at intermediate location
 *
 * Example: L2 renamed to L3-L2 (interpreted as move L2 → L2/L3)
 * - oldChain: [Library, L1, L2] → suffix: ["L2", "L1"]
 * - observedPathParts: ["Library", "L1", "L3-L2"] (where Obsidian moved it)
 * - Result: { pathParts: ["Library", "L1", "L3-L2"], basename: "__-L2-L1" }
 */
function buildIntermediateCodexPath(
	oldChain: SectionNodeSegmentId[],
	observedPathParts: string[],
	codecs: Codecs,
): SplitPathToMdFileInsideLibrary {
	const oldNodeNames = extractNodeNamesFromChain(oldChain, codecs);
	const suffixParts = computeCodexSuffix(oldNodeNames);

	const basename = codecs.suffix.serializeSeparatedSuffix({
		coreName: CODEX_CORE_NAME,
		suffixParts,
	});

	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: observedPathParts,
	};
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
	const oldNodeNames = extractNodeNamesFromChain(oldChain, codecs);
	const newNodeNames = extractNodeNamesFromChain(newChain, codecs);
	const suffixParts = computeCodexSuffix(oldNodeNames);

	const basename = codecs.suffix.serializeSeparatedSuffix({
		coreName: CODEX_CORE_NAME,
		suffixParts,
	});

	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: newNodeNames,
	};
}
