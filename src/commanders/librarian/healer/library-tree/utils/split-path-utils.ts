/**
 * Split path utilities for the library tree.
 *
 * NOTE: For new code, prefer importing from `src/commanders/librarian-new/paths/path-computer.ts`
 * which consolidates all path computation logic. This file is kept for backward compatibility.
 *
 * @see PathFinder in `src/commanders/librarian-new/paths/path-computer.ts`
 */
import { ok, type Result } from "neverthrow";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	AnySplitPathInsideLibrary,
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../codecs";
import type { CodecError } from "../../../codecs/errors";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "../../../codecs/locator/types";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { FileNode, ScrollNode } from "../tree-node/types/tree-node";

/**
 * Compare two split paths for equality.
 * Pure function, no dependencies.
 */
export function splitPathsEqual(
	a: AnySplitPathInsideLibrary,
	b: AnySplitPathInsideLibrary,
): boolean {
	if (a.kind !== b.kind) return false;
	if (a.basename !== b.basename) return false;
	if (a.pathParts.length !== b.pathParts.length) return false;
	for (let i = 0; i < a.pathParts.length; i++) {
		if (a.pathParts[i] !== b.pathParts[i]) return false;
	}
	if ("extension" in a && "extension" in b && a.extension !== b.extension) {
		return false;
	}
	return true;
}

/**
 * Build the "observed" split path for a leaf after section rename/move.
 *
 * @param leaf - the leaf node
 * @param oldSuffixPathParts - OLD path (for computing old basename suffix)
 * @param currentPathParts - NEW path (where file IS now in filesystem)
 * @param codecs - Codec API
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
			extension: MD,
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

/**
 * Build canonical split path from locator.
 * Returns Result instead of throwing.
 */
export function buildCanonicalLeafSplitPath(
	locator: ScrollNodeLocator | FileNodeLocator,
	codecs: Codecs,
): Result<
	SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary,
	CodecError
> {
	// Convert locator to canonical split path, then to split path
	return codecs.locator
		.locatorToCanonicalSplitPathInsideLibrary(locator)
		.andThen((canonical) => {
			// Convert canonical to split path
			const splitPath =
				codecs.splitPathWithSeparatedSuffix.fromSplitPathInsideLibraryWithSeparatedSuffix(
					canonical,
				);

			// Type assertion: leaf locators (Scroll/File) only produce MdFile/File split paths, never Folder
			// The codec chain preserves types, but TypeScript widens due to union input
			return ok(
				splitPath as
					| SplitPathToMdFileInsideLibrary
					| SplitPathToFileInsideLibrary,
			);
		});
}
