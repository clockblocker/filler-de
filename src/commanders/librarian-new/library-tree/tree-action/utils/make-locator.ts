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
} from "./canonical-split-path-utils/types";

export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathToFileInsideLibrary,
): FileNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathToMdFileInsideLibrary,
): ScrollNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathToFolderInsideLibrary,
): SectionNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathInsideLibrary,
): TreeNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathInsideLibrary,
): TreeNodeLocator {
	const segmentIdChainToParent = sp.sectionNames.map((nodeName) =>
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
					nodeName: sp.nodeName,
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
					nodeName: sp.nodeName,
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
					nodeName: sp.nodeName,
					type: TreeNodeType.Section,
				}),
				segmentIdChainToParent,
				targetType: TreeNodeType.Section,
			} satisfies SectionNodeLocator;
		}
	}
}
