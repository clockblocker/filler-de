import type { Prettify } from "../../../../../../types/helpers";
import type { NodeName } from "../../../../types/schemas/node-name";
import type {
	FileExtension,
	MdExtension,
	TreeNodeStatus,
	TreeNodeType,
} from "./atoms";
import type { TreeNodeSegmentId } from "./node-segment-id";

export type ScrollNode = {
	nodeName: NodeName;
	type: typeof TreeNodeType.Scroll;
	status: TreeNodeStatus;
	extension: MdExtension;
};

export type FileNode = {
	nodeName: NodeName;
	type: typeof TreeNodeType.File;
	status: typeof TreeNodeStatus.Unknown;
	extension: FileExtension;
};

export type LeafNode = ScrollNode | FileNode;

export type SectionNode = {
	nodeName: NodeName;
	type: typeof TreeNodeType.Section;
	children: Record<TreeNodeSegmentId, TreeNode>;
};

export type TreeNode = Prettify<ScrollNode | FileNode | SectionNode>;
