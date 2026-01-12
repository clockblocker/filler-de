import { MD } from "../../../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
	NodeLocatorOf,
	TreeNodeLocator,
} from "../../../../../codecs/locator/types";
import type {
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "../../../../../codecs/segment-id";
import { NodeSegmentIdSeparator } from "../../../../../codecs/segment-id/types/segment-id";
import type { NodeName } from "../../../../../types/schemas/node-name";
import { makeNodeSegmentId } from "../../../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type { FileExtension } from "../../../tree-node/types/atoms";
import { TreeNodeKind } from "../../../tree-node/types/atoms";
import { tryBuildCanonicalSeparatedSuffixedBasename } from "../canonical-naming/suffix-utils/build-canonical-separated-suffixed-basename-path-king-way";

/**
 * @deprecated Use `codecs.locator.canonicalSplitPathInsideLibraryToLocator` instead.
 * This function will be removed in a future version.
 */
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFileInsideLibrary,
): NodeLocatorOf<"File">;
/**
 * @deprecated Use `codecs.locator.canonicalSplitPathInsideLibraryToLocator` instead.
 * This function will be removed in a future version.
 */
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathToMdFileInsideLibrary,
): NodeLocatorOf<"Scroll">;
/**
 * @deprecated Use `codecs.locator.canonicalSplitPathInsideLibraryToLocator` instead.
 * This function will be removed in a future version.
 */
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFolderInsideLibrary,
): NodeLocatorOf<"Section">;
/**
 * @deprecated Use `codecs.locator.canonicalSplitPathInsideLibraryToLocator` instead.
 * This function will be removed in a future version.
 */
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): TreeNodeLocator;
/**
 * @deprecated Use `codecs.locator.canonicalSplitPathInsideLibraryToLocator` instead.
 * This function will be removed in a future version.
 */
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): TreeNodeLocator {
	// Both pathParts and segmentIdChainToParent INCLUDE Library root
	const segmentIdChainToParent = sp.pathParts.map((nodeName) =>
		makeNodeSegmentId({
			children: {},
			kind: TreeNodeKind.Section,
			nodeName,
		}),
	);

	switch (sp.kind) {
		case SplitPathKind.File: {
			return {
				segmentId: makeNodeSegmentId({
					extension: sp.extension,
					kind: TreeNodeKind.File,
					nodeName: sp.separatedSuffixedBasename.coreName,
					status: "Unknown",
				}),
				segmentIdChainToParent,
				targetKind: TreeNodeKind.File,
			} satisfies NodeLocatorOf<"File">;
		}

		case SplitPathKind.MdFile: {
			return {
				segmentId: makeNodeSegmentId({
					extension: "md",
					kind: TreeNodeKind.Scroll,
					nodeName: sp.separatedSuffixedBasename.coreName,
					status: "Unknown",
				}),
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Scroll,
			} satisfies NodeLocatorOf<"Scroll">;
		}

		case SplitPathKind.Folder: {
			return {
				segmentId: makeNodeSegmentId({
					children: {},
					kind: TreeNodeKind.Section,
					nodeName: sp.separatedSuffixedBasename.coreName,
				}),
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Section,
			} satisfies NodeLocatorOf<"Section">;
		}
	}
}

/**
 * @deprecated Use `codecs.locator.locatorToCanonicalSplitPathInsideLibrary` instead.
 * This function will be removed in a future version.
 */
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: NodeLocatorOf<"File">,
): CanonicalSplitPathToFileInsideLibrary;
/**
 * @deprecated Use `codecs.locator.locatorToCanonicalSplitPathInsideLibrary` instead.
 * This function will be removed in a future version.
 */
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: NodeLocatorOf<"Scroll">,
): CanonicalSplitPathToMdFileInsideLibrary;
/**
 * @deprecated Use `codecs.locator.locatorToCanonicalSplitPathInsideLibrary` instead.
 * This function will be removed in a future version.
 */
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: NodeLocatorOf<"Section">,
): CanonicalSplitPathToFolderInsideLibrary;
/**
 * @deprecated Use `codecs.locator.locatorToCanonicalSplitPathInsideLibrary` instead.
 * This function will be removed in a future version.
 */
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: TreeNodeLocator,
): CanonicalSplitPathInsideLibrary;
/**
 * @deprecated Use `codecs.locator.locatorToCanonicalSplitPathInsideLibrary` instead.
 * This function will be removed in a future version.
 */
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: TreeNodeLocator,
): CanonicalSplitPathInsideLibrary {
	// Both segmentIdChainToParent and pathParts INCLUDE Library root
	const pathParts = loc.segmentIdChainToParent.map(
		nodeNameFromSectionSegmentId,
	);

	const { coreName, targetKind, extension } = parseSegmentIdTrusted(
		loc.segmentId,
	);

	const canonicalRes = tryBuildCanonicalSeparatedSuffixedBasename({
		basename: coreName,
		kind:
			targetKind === TreeNodeKind.Section
				? SplitPathKind.Folder
				: SplitPathKind.File,
		pathParts,
	});

	if (canonicalRes.isErr())
		throw new Error(`${canonicalRes.error}. Should never happen!`);

	const suffixParts =
		canonicalRes.value.separatedSuffixedBasename.suffixParts;

	switch (targetKind) {
		case TreeNodeKind.Section: {
			return {
				kind: SplitPathKind.Folder,
				pathParts,
				separatedSuffixedBasename: { coreName, suffixParts },
			} satisfies CanonicalSplitPathToFolderInsideLibrary;
		}

		case TreeNodeKind.Scroll: {
			return {
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts,
				separatedSuffixedBasename: { coreName, suffixParts },
			} satisfies CanonicalSplitPathToMdFileInsideLibrary;
		}

		case TreeNodeKind.File: {
			return {
				extension: extension as FileExtension,
				kind: SplitPathKind.File,
				pathParts,
				separatedSuffixedBasename: { coreName, suffixParts },
			} satisfies CanonicalSplitPathToFileInsideLibrary;
		}
	}
}

function nodeNameFromSectionSegmentId(id: SectionNodeSegmentId): NodeName {
	const [nodeName] = id.split(NodeSegmentIdSeparator);
	return nodeName as NodeName;
}

function parseSegmentIdTrusted(id: TreeNodeSegmentId): {
	coreName: NodeName;
	targetKind: TreeNodeKind;
	extension?: string;
} {
	const [coreName, targetKind, extension] = id.split(NodeSegmentIdSeparator);

	return {
		coreName: coreName as NodeName,
		extension,
		targetKind: targetKind as TreeNodeKind,
	};
}
