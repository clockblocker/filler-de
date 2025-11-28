import { z } from "zod";
import type { LibraryNoteMetaInfo } from "../../services/dto-services/meta-info-manager/types";
import type { FullPathToFile } from "../../services/obsidian-services/file-services/types";
import type { TextStatus } from "../../types/common-interface/enums";
import type { Prettify } from "../../types/helpers";
import { PAGE, SECTION, TEXT } from "../../types/literals";
import type { GuardedNodeName } from "./indexing/formatters";

// Tree
export const NodeTypeSchema = z.enum([TEXT, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type TreePath = GuardedNodeName[];

export type CommonNode = {
	name: GuardedNodeName;
	status: TextStatus;
	type: NodeType;
	parent: BranchNode | null;
};

export type PageNode = Prettify<
	CommonNode & {
		type: typeof NodeType.Page;
	}
>;

export type TextNode = Prettify<
	CommonNode & {
		type: typeof NodeType.Text;
		children: PageNode[];
	}
>;

export type SectionNode = Prettify<
	CommonNode & {
		type: typeof NodeType.Section;
		children: (SectionNode | TextNode)[];
	}
>;

export type BranchNode = SectionNode | TextNode;
export type TreeNode = Prettify<BranchNode | PageNode>;

export type LeafNode = Prettify<PageNode>;

export type TextDto = {
	path: TreePath;
	pageStatuses: Record<CommonNode["name"], CommonNode["status"]>;
};

export type LibraryFileDto = {
	metaInfo: LibraryNoteMetaInfo;
	splitPath: FullPathToFile;
};
