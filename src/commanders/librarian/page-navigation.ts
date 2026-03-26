import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../managers/obsidian/vault-action-manager/types/split-path";
import type { Codecs } from "./codecs";
import type { SectionNodeSegmentId } from "./codecs/segment-id/types/segment-id";
import { sortTreeNodesForDisplay } from "./display-name-sort";
import type { Healer } from "./healer/healer";
import { isCodexSplitPath } from "./healer/library-tree/codex/helpers";
import { TreeNodeKind } from "./healer/library-tree/tree-node/types/atoms";
import type {
	ScrollNode,
	SectionNode,
} from "./healer/library-tree/tree-node/types/tree-node";

/**
 * Get previous library scroll using the tree's display order.
 */
export function getPrevPage(
	healer: Healer,
	codecs: Codecs,
	currentFilePath: SplitPathToMdFile,
): SplitPathToMdFile | null {
	return getAdjacentPage(healer, codecs, currentFilePath, -1);
}

/**
 * Get next library scroll using the tree's display order.
 */
export function getNextPage(
	healer: Healer,
	codecs: Codecs,
	currentFilePath: SplitPathToMdFile,
): SplitPathToMdFile | null {
	return getAdjacentPage(healer, codecs, currentFilePath, 1);
}

/**
 * Internal helper to find the adjacent library scroll (prev or next).
 * @param direction -1 for prev, +1 for next
 */
function getAdjacentPage(
	healer: Healer,
	codecs: Codecs,
	currentFilePath: SplitPathToMdFile,
	direction: -1 | 1,
): SplitPathToMdFile | null {
	if (isCodexSplitPath(currentFilePath)) {
		return direction === -1
			? null
			: getFirstDirectScrollInSection(
					healer,
					codecs,
					currentFilePath.pathParts,
				);
	}

	const parsedSuffix = codecs.suffix.parseSeparatedSuffix(
		currentFilePath.basename,
	);
	if (parsedSuffix.isErr()) return null;

	if (direction === -1) {
		const section = findSectionByPathParts(
			healer,
			codecs,
			currentFilePath.pathParts,
		);
		const firstDirectScroll = section
			? (getSortedDirectScrolls(section)[0] ?? null)
			: null;
		if (firstDirectScroll?.nodeName === parsedSuffix.value.coreName) {
			return buildCodexPath(currentFilePath.pathParts, codecs);
		}
	}

	const allScrolls = collectScrollsForNavigation(healer.getRoot(), [
		healer.getRoot().nodeName,
	]);
	const currentIndex = allScrolls.findIndex(
		(entry) =>
			entry.nodeName === parsedSuffix.value.coreName &&
			pathPartsEqual(entry.pathParts, currentFilePath.pathParts),
	);
	if (currentIndex < 0) return null;

	const target = allScrolls[currentIndex + direction];
	if (!target) return null;

	return buildScrollPath(target.pathParts, target.nodeName, codecs);
}

type ScrollNavigationEntry = {
	nodeName: string;
	pathParts: string[];
};

function getFirstDirectScrollInSection(
	healer: Healer,
	codecs: Codecs,
	pathParts: string[],
): SplitPathToMdFile | null {
	const section = findSectionByPathParts(healer, codecs, pathParts);
	if (!section) {
		return null;
	}

	const firstScroll = getSortedDirectScrolls(section)[0];
	if (!firstScroll) {
		return null;
	}

	return buildScrollPath(pathParts, firstScroll.nodeName, codecs);
}

function collectScrollsForNavigation(
	section: SectionNode,
	pathParts: string[],
): ScrollNavigationEntry[] {
	const entries: ScrollNavigationEntry[] = [];

	for (const child of sortTreeNodesForDisplay(
		Object.values(section.children),
	)) {
		if (child.kind === TreeNodeKind.Scroll) {
			entries.push(makeScrollNavigationEntry(child, pathParts));
			continue;
		}
		if (child.kind === TreeNodeKind.Section) {
			entries.push(
				...collectScrollsForNavigation(child, [
					...pathParts,
					child.nodeName,
				]),
			);
		}
	}

	return entries;
}

function getSortedDirectScrolls(section: SectionNode): ScrollNode[] {
	return sortTreeNodesForDisplay(Object.values(section.children)).filter(
		(child): child is ScrollNode => child.kind === TreeNodeKind.Scroll,
	);
}

function makeScrollNavigationEntry(
	scroll: ScrollNode,
	pathParts: string[],
): ScrollNavigationEntry {
	return {
		nodeName: scroll.nodeName,
		pathParts: [...pathParts],
	};
}

function pathPartsEqual(left: string[], right: string[]): boolean {
	return (
		left.length === right.length &&
		left.every((part, index) => part === right[index])
	);
}

function findSectionByPathParts(
	healer: Healer,
	codecs: Codecs,
	pathParts: string[],
): SectionNode | undefined {
	const chain: SectionNodeSegmentId[] = [];

	for (const part of pathParts) {
		const segmentIdResult = codecs.segmentId.serializeSegmentIdUnchecked({
			coreName: part,
			targetKind: TreeNodeKind.Section,
		});
		if (segmentIdResult.isErr()) {
			return undefined;
		}
		chain.push(segmentIdResult.value as SectionNodeSegmentId);
	}

	return healer.findSection(chain);
}

function buildCodexPath(
	pathParts: string[],
	codecs: Codecs,
): SplitPathToMdFile | null {
	const [rootSection] = pathParts;
	if (!rootSection) {
		return null;
	}

	const suffixParts =
		pathParts.length === 1
			? [rootSection]
			: codecs.suffix.pathPartsToSuffixParts(pathParts.slice(1));
	const basenameResult = codecs.suffix.serializeSeparatedSuffixUnchecked({
		coreName: "__",
		suffixParts,
	});
	if (basenameResult.isErr()) {
		return null;
	}

	return {
		basename: basenameResult.value,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: [...pathParts],
	};
}

function buildScrollPath(
	pathParts: string[],
	nodeName: string,
	codecs: Codecs,
): SplitPathToMdFile | null {
	const suffixParts = codecs.suffix.pathPartsWithRootToSuffixParts(pathParts);
	const basenameResult = codecs.suffix.serializeSeparatedSuffixUnchecked({
		coreName: nodeName,
		suffixParts,
	});
	if (basenameResult.isErr()) {
		return null;
	}

	return {
		basename: basenameResult.value,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: [...pathParts],
	};
}
