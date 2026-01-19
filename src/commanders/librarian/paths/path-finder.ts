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

import { err, ok, type Result } from "neverthrow";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { logger } from "../../../utils/logger";
import type {
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../codecs";
import type { CodecError } from "../codecs/errors";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "../codecs/locator/types";
import type {
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../healer/library-tree/tree-node/types/atoms";
import type {
	FileNode,
	ScrollNode,
} from "../healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../types/schemas/node-name";

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

/**
 * Convert path parts (WITHOUT Library root) to suffix parts.
 * Simply reverses the array.
 */
export function pathPartsToSuffixParts(pathParts: string[]): NodeName[] {
	return [...pathParts].reverse() as NodeName[];
}

/**
 * Convert path parts (WITH Library root) to suffix parts.
 * Drops the Library root, then reverses.
 */
export function pathPartsWithRootToSuffixParts(
	pathParts: string[],
): NodeName[] {
	// Drop Library root (first element), then reverse
	return pathParts.slice(1).reverse() as NodeName[];
}

/**
 * Convert suffix parts back to path parts.
 * Simply reverses the array.
 */
export function suffixPartsToPathParts(suffixParts: NodeName[]): string[] {
	return [...suffixParts].reverse();
}

// ─── Segment ID Parsing ───

/**
 * Parse a chain of segment IDs to extract node names.
 * Returns Result to handle parse failures explicitly.
 *
 * @param chain - Array of segment IDs
 * @param codecs - Codec instance for parsing
 */
export function parseChainToNodeNames(
	chain: TreeNodeSegmentId[],
	codecs: Codecs,
): Result<string[], PathFinderError> {
	if (chain.length === 0) {
		return err({ kind: "EmptyChain", reason: "Cannot parse empty chain" });
	}

	const nodeNames: string[] = [];

	for (const segId of chain) {
		const parseResult = codecs.segmentId.parseSegmentId(segId);
		if (parseResult.isErr()) {
			return err({
				kind: "ParseFailed",
				reason: parseResult.error.message,
				segmentId: segId,
			});
		}
		nodeNames.push(parseResult.value.coreName);
	}

	return ok(nodeNames);
}

/**
 * Parse a section chain (parent chain) to extract node names.
 * Specialized version for section chains.
 */
export function parseSectionChainToNodeNames(
	chain: SectionNodeSegmentId[],
	codecs: Codecs,
): Result<string[], PathFinderError> {
	return parseChainToNodeNames(chain as TreeNodeSegmentId[], codecs);
}

// ─── Canonical Path Building ───

/**
 * Build canonical split path from a leaf locator.
 * Returns Result instead of throwing.
 */
export function buildCanonicalLeafSplitPath(
	locator: ScrollNodeLocator | FileNodeLocator,
	codecs: Codecs,
): Result<
	SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary,
	CodecError
> {
	return codecs.locator
		.locatorToCanonicalSplitPathInsideLibrary(locator)
		.andThen((canonical) => {
			const splitPath =
				codecs.splitPathWithSeparatedSuffix.fromSplitPathInsideLibraryWithSeparatedSuffix(
					canonical,
				);
			return ok(
				splitPath as
					| SplitPathToMdFileInsideLibrary
					| SplitPathToFileInsideLibrary,
			);
		});
}

/**
 * Build the "observed" split path for a leaf after section rename/move.
 *
 * This handles the case where:
 * - The file's suffix should come from its OLD location (what basename it has)
 * - But the file is NOW at a NEW location (where it physically exists)
 *
 * @param leaf - The leaf node (Scroll or File)
 * @param oldSuffixPathParts - OLD path (WITH Library root) for computing suffix
 * @param currentPathParts - NEW path (where file is NOW in filesystem)
 * @param codecs - Codec instance
 */
export function buildObservedLeafSplitPath(
	leaf: ScrollNode | FileNode,
	oldSuffixPathParts: string[],
	currentPathParts: string[],
	codecs: Codecs,
): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
	// Suffix from OLD path (what the file WAS named)
	const suffixParts =
		codecs.suffix.pathPartsWithRootToSuffixParts(oldSuffixPathParts);

	const basename = codecs.suffix.serializeSeparatedSuffix({
		coreName: leaf.nodeName,
		suffixParts,
	});

	// pathParts = CURRENT path (where file IS now)
	if (leaf.kind === TreeNodeKind.Scroll) {
		return {
			basename,
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: currentPathParts,
		};
	}

	return {
		basename,
		extension: leaf.extension,
		kind: SplitPathKind.File,
		pathParts: currentPathParts,
	};
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
): Result<string[], PathFinderError> {
	return parseSectionChainToNodeNames(chain, codecs);
}

/**
 * Build canonical path for a section from its parent chain and node name.
 */
export function buildSectionCanonicalPath(
	parentChain: SectionNodeSegmentId[],
	nodeName: NodeName,
	libraryRoot: NodeName,
	codecs: Codecs,
): Result<string[], PathFinderError> {
	const parentNamesResult = parseSectionChainToNodeNames(parentChain, codecs);
	if (parentNamesResult.isErr()) {
		return parentNamesResult;
	}

	// Include Library root at the beginning
	return ok([libraryRoot, ...parentNamesResult.value, nodeName]);
}

// ─── Codex Path Building ───

/**
 * Build codex file basename from node names chain.
 *
 * @param nodeNames - Chain of node names from Library root to section
 * @param codexPrefix - Prefix for codex files (e.g., "__")
 * @param codecs - Codec instance
 */
export function buildCodexBasename(
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
): Result<SplitPathToMdFileInsideLibrary, PathFinderError> {
	if (sectionChain.length === 0) {
		return err({
			kind: "EmptyChain",
			reason: "Section chain cannot be empty",
		});
	}

	// Parse chain to get node names (includes Library root)
	const nodeNamesResult = parseSectionChainToNodeNames(sectionChain, codecs);
	if (nodeNamesResult.isErr()) {
		return err(nodeNamesResult.error);
	}

	const nodeNames = nodeNamesResult.value;
	const basename = buildCodexBasename(nodeNames, codexPrefix, codecs);

	// pathParts = nodeNames (already includes Library root from chain)
	return ok({
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: nodeNames,
	});
}

// ─── Path Comparison ───

/**
 * Compare two split paths for equality.
 */
export function splitPathsEqual(
	a: {
		kind: string;
		basename: string;
		pathParts: string[];
		extension?: string;
	},
	b: {
		kind: string;
		basename: string;
		pathParts: string[];
		extension?: string;
	},
): boolean {
	if (a.kind !== b.kind) return false;
	if (a.basename !== b.basename) return false;
	if (a.pathParts.length !== b.pathParts.length) return false;
	for (let i = 0; i < a.pathParts.length; i++) {
		if (a.pathParts[i] !== b.pathParts[i]) return false;
	}
	if (a.extension !== b.extension) return false;
	return true;
}

// ─── Segment ID Validation (Issue 13) ───

/**
 * Validate and narrow a string to SectionNodeSegmentId.
 * Returns Result for explicit error handling.
 *
 * Use when:
 * - Parsing user input or external data
 * - Any untrusted segment ID string
 *
 * @param segmentId - The segment ID to validate
 * @param codecs - Codec instance for parsing
 */
export function validateSectionSegmentId(
	segmentId: string,
	codecs: Codecs,
): Result<SectionNodeSegmentId, PathFinderError> {
	// Cast to TreeNodeSegmentId for parsing - this function validates untrusted strings
	const parseResult = codecs.segmentId.parseSegmentId(
		segmentId as TreeNodeSegmentId,
	);
	if (parseResult.isErr()) {
		return err({
			kind: "ParseFailed",
			reason: parseResult.error.message,
			segmentId,
		});
	}

	if (parseResult.value.targetKind !== TreeNodeKind.Section) {
		return err({
			kind: "ParseFailed",
			reason: `Expected Section segment ID, got ${parseResult.value.targetKind}`,
			segmentId,
		});
	}

	return ok(segmentId as SectionNodeSegmentId);
}

/**
 * Validate and narrow a parsed segment ID result to SectionNodeSegmentId.
 * Use after codecs.segmentId.serializeSegmentId when you know the input was targetKind: Section.
 *
 * This is the PREFERRED way to narrow after serialization, as it validates
 * the result rather than blindly casting.
 *
 * @param segmentId - The serialized segment ID
 * @param expectedKind - Expected target kind (should be TreeNodeKind.Section)
 * @param codecs - Codec instance for parsing
 */
export function assertSectionSegmentId(
	segmentId: TreeNodeSegmentId,
	expectedKind: typeof TreeNodeKind.Section,
	codecs: Codecs,
): SectionNodeSegmentId {
	const parseResult = codecs.segmentId.parseSegmentId(segmentId);
	if (parseResult.isErr()) {
		logger.error(
			"[assertSectionSegmentId] Parse failed",
			JSON.stringify({ error: parseResult.error.message, segmentId }),
		);
		throw new Error(
			`Invalid segment ID '${segmentId}': ${parseResult.error.message}`,
		);
	}

	if (parseResult.value.targetKind !== expectedKind) {
		logger.error(
			"[assertSectionSegmentId] Wrong target kind",
			JSON.stringify({
				actual: parseResult.value.targetKind,
				expected: expectedKind,
				segmentId,
			}),
		);
		throw new Error(
			`Expected ${expectedKind} segment ID, got ${parseResult.value.targetKind}: '${segmentId}'`,
		);
	}

	return segmentId as SectionNodeSegmentId;
}

/**
 * Validate an array of strings as SectionNodeSegmentId[].
 * Returns Result for explicit error handling.
 *
 * @param chain - Array of segment ID strings
 * @param codecs - Codec instance for parsing
 */
export function validateSectionChain(
	chain: string[],
	codecs: Codecs,
): Result<SectionNodeSegmentId[], PathFinderError> {
	const result: SectionNodeSegmentId[] = [];

	for (const segId of chain) {
		const validated = validateSectionSegmentId(segId, codecs);
		if (validated.isErr()) {
			return err(validated.error);
		}
		result.push(validated.value);
	}

	return ok(result);
}

/**
 * Cast a segment ID from tree children keys to SectionNodeSegmentId.
 *
 * Use ONLY when iterating over section.children where you've already
 * verified the child is a Section node. This is a "trusted cast" that
 * logs a warning if validation fails (for debugging).
 *
 * @param segId - Segment ID from Object.entries(section.children)
 * @param childKind - The child node's kind (must be Section)
 */
export function narrowChildSegmentId(
	segId: string,
	childKind: TreeNodeKind,
): SectionNodeSegmentId {
	if (childKind !== TreeNodeKind.Section) {
		logger.warn(
			"[narrowChildSegmentId] Expected Section child",
			JSON.stringify({ actualKind: childKind, segId }),
		);
	}
	// Type assertion justified: tree invariant - section children with kind Section
	// have SectionNodeSegmentId keys. Logged if invariant violated.
	return segId as SectionNodeSegmentId;
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
