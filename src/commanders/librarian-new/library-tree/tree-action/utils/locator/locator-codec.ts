import { MD } from "../../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathType } from "../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../../types/schemas/node-name";
import { makeNodeSegmentId } from "../../../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import {
	type FileExtension,
	TreeNodeType,
} from "../../../tree-node/types/atoms";
import {
	NodeSegmentIdSeparator,
	type SectionNodeSegmentId,
	type TreeNodeSegmentId,
} from "../../../tree-node/types/node-segment-id";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "../../types/target-chains";
import { tryBuildCanonicalSeparatedSuffixedBasename } from "../canonical-naming/suffix-utils/build-canonical-separated-suffixed-basename-path-king-way";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../canonical-naming/types";

export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFileInsideLibrary,
): FileNodeLocator;
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathToMdFileInsideLibrary,
): ScrollNodeLocator;
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathToFolderInsideLibrary,
): SectionNodeLocator;
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): TreeNodeLocator;
export function makeLocatorFromCanonicalSplitPathInsideLibrary(
	sp: CanonicalSplitPathInsideLibrary,
): TreeNodeLocator {
	// Both pathParts and segmentIdChainToParent INCLUDE Library root
	const segmentIdChainToParent = sp.pathParts.map((nodeName) =>
		makeNodeSegmentId({
			children: {},
			nodeName,
			type: TreeNodeType.Section,
		}),
	);

	switch (sp.type) {
		case SplitPathType.File: {
			return {
				segmentId: makeNodeSegmentId({
					extension: sp.extension,
					nodeName: sp.separatedSuffixedBasename.coreName,
					status: "Unknown",
					type: TreeNodeType.File,
				}),
				segmentIdChainToParent,
				targetType: TreeNodeType.File,
			} satisfies FileNodeLocator;
		}

		case SplitPathType.MdFile: {
			return {
				segmentId: makeNodeSegmentId({
					extension: "md",
					nodeName: sp.separatedSuffixedBasename.coreName,
					status: "Unknown",
					type: TreeNodeType.Scroll,
				}),
				segmentIdChainToParent,
				targetType: TreeNodeType.Scroll,
			} satisfies ScrollNodeLocator;
		}

		case SplitPathType.Folder: {
			return {
				segmentId: makeNodeSegmentId({
					children: {},
					nodeName: sp.separatedSuffixedBasename.coreName,
					type: TreeNodeType.Section,
				}),
				segmentIdChainToParent,
				targetType: TreeNodeType.Section,
			} satisfies SectionNodeLocator;
		}
	}
}

export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: FileNodeLocator,
): CanonicalSplitPathToFileInsideLibrary;
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: ScrollNodeLocator,
): CanonicalSplitPathToMdFileInsideLibrary;
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: SectionNodeLocator,
): CanonicalSplitPathToFolderInsideLibrary;
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: TreeNodeLocator,
): CanonicalSplitPathInsideLibrary;
export function makeCanonicalSplitPathInsideLibraryFromLocator(
	loc: TreeNodeLocator,
): CanonicalSplitPathInsideLibrary {
	// Both segmentIdChainToParent and pathParts INCLUDE Library root
	const pathParts = loc.segmentIdChainToParent.map(
		nodeNameFromSectionSegmentId,
	);

	const { coreName, targetType, extension } = parseSegmentIdTrusted(
		loc.segmentId,
	);

	const canonicalRes = tryBuildCanonicalSeparatedSuffixedBasename({
		basename: coreName,
		pathParts,
		type:
			targetType === TreeNodeType.Section
				? SplitPathType.Folder
				: SplitPathType.File,
	});

	if (canonicalRes.isErr())
		throw new Error(`${canonicalRes.error}. Should never happen!`);

	const suffixParts =
		canonicalRes.value.separatedSuffixedBasename.suffixParts;

	switch (targetType) {
		case TreeNodeType.Section: {
			return {
				pathParts,
				separatedSuffixedBasename: { coreName, suffixParts },
				type: SplitPathType.Folder,
			} satisfies CanonicalSplitPathToFolderInsideLibrary;
		}

		case TreeNodeType.Scroll: {
			return {
				extension: MD,
				pathParts,
				separatedSuffixedBasename: { coreName, suffixParts },
				type: SplitPathType.MdFile,
			} satisfies CanonicalSplitPathToMdFileInsideLibrary;
		}

		case TreeNodeType.File: {
			return {
				extension: extension as FileExtension,
				pathParts,
				separatedSuffixedBasename: { coreName, suffixParts },
				type: SplitPathType.File,
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
	targetType: TreeNodeType;
	extension?: string;
} {
	const [coreName, targetType, extension] = id.split(NodeSegmentIdSeparator);

	return {
		coreName: coreName as NodeName,
		extension,
		targetType: targetType as TreeNodeType,
	};
}
