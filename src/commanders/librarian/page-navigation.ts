import type { SplitPathToMdFile } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { parsePageIndex } from "./bookkeeper/page-codec";
import type { Codecs } from "./codecs";
import type { SectionNodeSegmentId } from "./codecs/segment-id/types/segment-id";
import type { Healer } from "./healer/healer";
import { TreeNodeKind } from "./healer/library-tree/tree-node/types/atoms";

/**
 * Get previous page by looking up siblings in tree.
 * Returns null if current is first page or not a page file.
 */
export function getPrevPage(
	healer: Healer,
	codecs: Codecs,
	currentFilePath: SplitPathToMdFile,
): SplitPathToMdFile | null {
	return getAdjacentPage(healer, codecs, currentFilePath, -1);
}

/**
 * Get next page by looking up siblings in tree.
 * Returns null if current is last page or not a page file.
 */
export function getNextPage(
	healer: Healer,
	codecs: Codecs,
	currentFilePath: SplitPathToMdFile,
): SplitPathToMdFile | null {
	return getAdjacentPage(healer, codecs, currentFilePath, 1);
}

/**
 * Internal helper to find adjacent page (prev or next).
 * @param direction -1 for prev, +1 for next
 */
function getAdjacentPage(
	healer: Healer,
	codecs: Codecs,
	currentFilePath: SplitPathToMdFile,
	direction: -1 | 1,
): SplitPathToMdFile | null {
	// 1. Parse coreName from basename (before suffix)
	const parsedSuffix = codecs.suffix.parseSeparatedSuffix(
		currentFilePath.basename,
	);
	if (parsedSuffix.isErr()) return null;

	const { coreName } = parsedSuffix.value;

	// 2. Parse page index from coreName
	const pageInfo = parsePageIndex(coreName);
	if (!pageInfo.isPage) return null;

	const targetIndex = pageInfo.pageIndex + direction;
	if (targetIndex < 0) return null;

	// 3. Get parent section from tree
	const parentChain = buildSectionChainFromPathParts(
		codecs,
		currentFilePath.pathParts,
	);
	if (!parentChain) return null;

	const parentSection = healer.findSection(parentChain);
	if (!parentSection) return null;

	// 4. Find sibling page with target index
	for (const child of Object.values(parentSection.children)) {
		if (child.kind !== TreeNodeKind.Scroll) continue;

		const childPageInfo = parsePageIndex(child.nodeName);
		if (
			childPageInfo.isPage &&
			childPageInfo.coreName === pageInfo.coreName &&
			childPageInfo.pageIndex === targetIndex
		) {
			// 5. Build new SplitPathToMdFile with new basename
			const suffixParts = codecs.suffix.pathPartsToSuffixParts(
				currentFilePath.pathParts.slice(1), // exclude library root
			);
			const newBasenameResult =
				codecs.suffix.serializeSeparatedSuffixUnchecked({
					coreName: child.nodeName,
					suffixParts,
				});
			if (newBasenameResult.isErr()) return null;

			return {
				...currentFilePath,
				basename: newBasenameResult.value,
			};
		}
	}

	return null;
}

/**
 * Build section chain (SectionNodeSegmentId[]) from pathParts.
 * PathParts include library root, followed by section names.
 */
function buildSectionChainFromPathParts(
	codecs: Codecs,
	pathParts: string[],
): SectionNodeSegmentId[] | null {
	const chain: SectionNodeSegmentId[] = [];

	for (const part of pathParts) {
		const segmentIdResult = codecs.segmentId.serializeSegmentIdUnchecked({
			coreName: part,
			targetKind: TreeNodeKind.Section,
		});
		if (segmentIdResult.isErr()) return null;
		chain.push(segmentIdResult.value as SectionNodeSegmentId);
	}

	return chain;
}
