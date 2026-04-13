import type { MD } from "@textfresser/vault-action-manager";
import { SplitPathKind } from "@textfresser/vault-action-manager";
import type { InvertRecord } from "../../internal/root/type-helpers";
import type { FileExtension } from "../../healer/library-tree/tree-node/types/atoms";
import { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../types/schemas/node-name";

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
	import("@textfresser/vault-action-manager").SplitPath<
		CorrespondingSplitPathKind<T>
	>;

export type TreeNodeKindForSplitPath<T extends SplitPathKind> =
	CorrespondingTreeNodeKind<T>;

type SegmentIdComponentsMap = {
	[TreeNodeKind.Section]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.Section;
		extension?: never; // <-- forbidden, prevents extension from sneaking in
	};
	[TreeNodeKind.Scroll]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.Scroll;
		extension: MD;
	};
	[TreeNodeKind.File]: {
		coreName: NodeName;
		targetKind: typeof TreeNodeKind.File;
		extension: FileExtension;
	};
};

export type SegmentIdComponents<NK extends TreeNodeKind> =
	SegmentIdComponentsMap[NK];
