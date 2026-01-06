import { SplitPathType } from "../../../../../obsidian-vault-action-manager/types/split-path";
import { makeNodeSegmentId } from "../../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeType } from "../../tree-node/types/atoms";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "../types/target-chains";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "./canonical-naming/types";

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
