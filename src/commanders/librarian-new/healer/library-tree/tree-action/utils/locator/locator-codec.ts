import { MD } from "../../../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../../../types/schemas/node-name";
import { makeNodeSegmentId } from "../../../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import {
	type FileExtension,
	TreeNodeKind,
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
			} satisfies FileNodeLocator;
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
			} satisfies ScrollNodeLocator;
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
