import { z } from "zod";
import type { LibraryNoteMetaInfo } from "../../services/dto-services/meta-info-manager/types";
import type { FullPathToFile } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { TextStatus } from "../../types/common-interface/enums";
import type { Prettify } from "../../types/helpers";
import { NOTE, PAGE, SECTION, TEXT } from "../../types/literals";
import type { GuardedNodeName } from "./indexing/formatters";

// Tree - Current model: Section → Text → Page (3 levels)
// TODO: Migrate to Section → Note (2 levels)
export const NodeTypeSchema = z.enum([TEXT, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

// New simplified NodeType for future migration
export const NodeTypeV2Schema = z.enum([SECTION, NOTE]);
export type NodeTypeV2 = z.infer<typeof NodeTypeV2Schema>;
export const NodeTypeV2 = NodeTypeV2Schema.enum;

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

// === New types for V2 (flat Note model) ===

// NoteNode is a leaf (will replace PageNode in V2)
export type NoteNode = Prettify<{
	name: GuardedNodeName;
	status: TextStatus;
	type: typeof NodeTypeV2.Note;
	parent: SectionNodeV2 | null;
}>;

// SectionNodeV2 contains Sections or Notes (no TextNode intermediate)
export type SectionNodeV2 = Prettify<{
	name: GuardedNodeName;
	status: TextStatus;
	type: typeof NodeTypeV2.Section;
	parent: SectionNodeV2 | null;
	children: (SectionNodeV2 | NoteNode)[];
}>;

// NoteDto - flat structure, one DTO per note/file (V2)
export type NoteDto = {
	path: TreePath;
	status: TextStatus;
};

// Legacy: TextDto with pageStatuses
export type TextDto = {
	path: TreePath;
	pageStatuses: Record<CommonNode["name"], CommonNode["status"]>;
};

export type LibraryFileDto = {
	metaInfo: LibraryNoteMetaInfo;
	fullPath: FullPathToFile;
};
