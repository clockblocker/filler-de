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
	CanonicalSplitPath,
	CanonicalSplitPathToFile,
	CanonicalSplitPathToFolder,
	CanonicalSplitPathToMdFile,
} from "./canonical-split-path/types";

export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathToFile,
): FileNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathToMdFile,
): ScrollNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPathToFolder,
): SectionNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPath,
): TreeNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	sp: CanonicalSplitPath,
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

		default: {
			const _never: never = sp;
			return _never;
		}
	}
}
