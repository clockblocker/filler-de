/**
 * PathFinder - Consolidated path and suffix computation logic.
 *
 * This module is the single source of truth for all path operations in the
 * librarian system. It consolidates logic that was previously duplicated in:
 * - codecs/internal/suffix/path-parts.ts
 * - codecs/internal/suffix/serialize.ts
 * - healer/library-tree/utils/split-path-utils.ts
 * - healer/healing-computers/descendant-suffix-healing.ts
 * - healer/library-tree/codex/codex-impact-to-actions.ts
 *
 * All suffix computation should go through this module.
 */

import { MD, SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type { Codecs, SplitPathToMdFileInsideLibrary } from "./codecs";
import { parseSectionChainCoreNames } from "./codecs/segment-id/section-chain";
import type {
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "./codecs/segment-id/types/segment-id";
import type { TreeNodeKind } from "./healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "./types/schemas/node-name";

// ─── Types ───

export type PathFinderError =
	| { kind: "ParseFailed"; segmentId: string; reason: string }
	| { kind: "InvalidChain"; chain: string[]; reason: string }
	| { kind: "EmptyChain"; reason: string };

// ─── Core Suffix Computation ───

/**
 * Compute codex suffix from a chain of node names.
 *
 * This is the CRITICAL logic that determines the suffix for codex files:
 * - Single node: suffix is the node itself
 * - Multiple nodes: suffix is the tail (without first element), reversed
 *
 * Example:
 * - ["root"] -> ["root"]
 * - ["root", "child"] -> ["child"]
 * - ["a", "b", "c"] -> ["c", "b"]
 *
 * @param nodeNames - Chain of node names from root to current section
 */
export function computeCodexSuffix(nodeNames: string[]): string[] {
	if (nodeNames.length === 0) {
		return [];
	}
	if (nodeNames.length === 1) {
		return nodeNames;
	}
	// Drop first element, reverse the rest
	return nodeNames.slice(1).reverse();
}

// ─── Segment ID Parsing ───

/**
 * Parse a section chain (parent chain) to extract node names.
 * Returns Result to handle parse failures explicitly.
 *
 * @param chain - Array of section segment IDs
 * @param codecs - Codec instance for parsing
 */
export function parseSectionChainToNodeNames(
	chain: SectionNodeSegmentId[],
	codecs: Codecs,
): Result.Result<string[], PathFinderError> {
	if (chain.length === 0) {
		return Result.fail({
			kind: "EmptyChain",
			reason: "Cannot parse empty chain",
		});
	}

	return Result.mapError(
		parseSectionChainCoreNames(chain, codecs.segmentId),
		({ error, segmentId }): PathFinderError => ({
			kind: "ParseFailed",
			reason: error.message,
			segmentId,
		}),
	);
}

// ─── Section Path Building ───

/**
 * Convert a section chain to path parts.
 * Parses each segment ID and extracts the node name.
 *
 * @param chain - Section segment ID chain
 * @param codecs - Codec instance
 */
export function sectionChainToPathParts(
	chain: SectionNodeSegmentId[],
	codecs: Codecs,
): Result.Result<string[], PathFinderError> {
	return parseSectionChainToNodeNames(chain, codecs);
}

// ─── Codex Path Building ───

/**
 * Build codex file basename from node names chain.
 *
 * @param nodeNames - Chain of node names from Library root to section
 * @param codexPrefix - Prefix for codex files (e.g., "__")
 * @param codecs - Codec instance
 */
function buildCodexBasename(
	nodeNames: string[],
	codexPrefix: string,
	codecs: Codecs,
): string {
	const suffixParts = computeCodexSuffix(nodeNames);

	// For codex, the coreName is the prefix
	return codecs.suffix.serializeSeparatedSuffix({
		coreName: codexPrefix as NodeName,
		suffixParts: suffixParts as NodeName[],
	});
}

/**
 * Build the full codex split path for a section.
 *
 * @param sectionChain - Full chain including Library root, e.g. ["Library﹘Section﹘", "A﹘Section﹘"]
 * @param codexPrefix - Prefix for codex files (e.g., "__")
 * @param codecs - Codec instance
 */
export function buildCodexSplitPath(
	sectionChain: SectionNodeSegmentId[],
	codexPrefix: string,
	codecs: Codecs,
): Result.Result<SplitPathToMdFileInsideLibrary, PathFinderError> {
	if (sectionChain.length === 0) {
		return Result.fail({
			kind: "EmptyChain",
			reason: "Section chain cannot be empty",
		});
	}

	// Parse chain to get node names (includes Library root)
	const nodeNamesResult = parseSectionChainToNodeNames(sectionChain, codecs);
	if (Result.isFailure(nodeNamesResult)) {
		return Result.fail(nodeNamesResult.failure);
	}

	const nodeNames = nodeNamesResult.success;
	const basename = buildCodexBasename(nodeNames, codexPrefix, codecs);

	// pathParts = nodeNames (already includes Library root from chain)
	return Result.succeed({
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: nodeNames,
	});
}

/**
 * Narrow locator segmentId to SectionNodeSegmentId when locator.targetKind is Section.
 *
 * Use when you have a locator and need to pass its segmentId to a function
 * expecting SectionNodeSegmentId. The type system can't narrow this automatically.
 *
 * @param locator - A locator with targetKind: TreeNodeKind.Section
 */
export function locatorToSectionSegmentId(locator: {
	segmentId: TreeNodeSegmentId;
	targetKind: typeof TreeNodeKind.Section;
}): SectionNodeSegmentId {
	// Type assertion justified: locator.segmentId type corresponds to locator.targetKind
	return locator.segmentId as SectionNodeSegmentId;
}
