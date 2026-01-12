import { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { InvertRecord } from "../../../../types/helpers";
import type { FileExtension } from "../../healer/library-tree/tree-node/types/atoms";
import { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../healer/library-tree/tree-node/types/node-segment-id";
import type { NodeName } from "../../types/schemas/node-name";
import type { CanonicalSplitPathInsideLibrary } from "../canonical-split-path/types/canonical-split-path";
import type { TreeNodeLocator } from "../locator/types";

export const TreeNodeKindToSplitPathKind = {
	[TreeNodeKind.Section]: SplitPathKind.Folder,
	[TreeNodeKind.Scroll]: SplitPathKind.MdFile,
	[TreeNodeKind.File]: SplitPathKind.File,
} as const satisfies Record<TreeNodeKind, SplitPathKind>;

type SplitPathKindToTreeNodeKind = InvertRecord<
	typeof TreeNodeKindToSplitPathKind
>;

export type CorrespondingSplitPathKind<NK extends TreeNodeKind> =
	(typeof TreeNodeKindToSplitPathKind)[NK];

export type CorrespondingTreeNodeKind<SK extends SplitPathKind> =
	SplitPathKindToTreeNodeKind[SK];

export type SplitPathForTreeNodeKind<T extends TreeNodeKind> =
	import("../../../../managers/obsidian/vault-action-manager/types/split-path").SplitPath<
		CorrespondingSplitPathKind<T>
	>;

export type TreeNodeKindForSplitPath<T extends SplitPathKind> =
	CorrespondingTreeNodeKind<T>;

export type NodeLocatorOf<NK extends TreeNodeKind> = Extract<
	TreeNodeLocator,
	{ targetKind: NK }
>;

export type CanonicalSplitPathInsideLibraryOf<SK extends SplitPathKind> =
	Extract<CanonicalSplitPathInsideLibrary, { kind: SK }>;

type SegmentIdComponentsMap = {
	[TreeNodeKind.Section]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.Section;
		extension?: never; // <-- forbidden, prevents extension from sneaking in
	};
	[TreeNodeKind.Scroll]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.Scroll;
		extension: "md";
	};
	[TreeNodeKind.File]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.File;
		extension: FileExtension;
	};
};

export type SegmentIdComponents<NK extends TreeNodeKind> =
	SegmentIdComponentsMap[NK];

export type SegmentIdOf<NK extends TreeNodeKind> =
	NK extends typeof TreeNodeKind.Section
		? SectionNodeSegmentId
		: NK extends typeof TreeNodeKind.Scroll
			? ScrollNodeSegmentId
			: NK extends typeof TreeNodeKind.File
				? FileNodeSegmentId
				: never;
