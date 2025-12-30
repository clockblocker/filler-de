import z from "zod";
import type { Prettify } from "../../../../../types/helpers";
import {
	CHANGE_NODE_STATUS_ACTION,
	CREATE_NODE_ACTION,
	DELETE_NODE_ACTION,
	MOVE_NODE_ACTION,
	RENAME_NODE_ACTION,
} from "../../../types/consts/literals";
import type { NodeName } from "../../../types/schemas/node-name";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { FileNode, ScrollNode } from "../../tree-node/types/tree-node";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "./target-chains";

const TreeActionTypeSchema = z.enum([
	CREATE_NODE_ACTION,
	DELETE_NODE_ACTION,
	RENAME_NODE_ACTION,
	CHANGE_NODE_STATUS_ACTION,
	MOVE_NODE_ACTION,
]);

export type TreeActionType = z.infer<typeof TreeActionTypeSchema>;
export const TreeActionType = TreeActionTypeSchema.enum;

// --- Create

export type CreateFileNodeAction = {
	actionType: typeof TreeActionType.CreateNode;
	target: FileNodeLocator;
	initialStatus?: FileNode["status"];
};

export type CreateSectionNodeAction = {
	actionType: typeof TreeActionType.CreateNode;
	target: SectionNodeLocator;
	initialStatus?: undefined;
};

export type CreateScrollNodeAction = {
	actionType: typeof TreeActionType.CreateNode;
	target: ScrollNodeLocator;
	initialStatus?: ScrollNode["status"];
};

export type CreateTreeNodeAction = Prettify<
	CreateFileNodeAction | CreateSectionNodeAction | CreateScrollNodeAction
>;

// --- Delete

export type DeleteFileNodeAction = {
	actionType: typeof TreeActionType.DeleteNode;
	target: FileNodeLocator;
};

export type DeleteSectionNodeAction = {
	actionType: typeof TreeActionType.DeleteNode;
	target: SectionNodeLocator;
};

export type DeleteScrollNodeAction = {
	actionType: typeof TreeActionType.DeleteNode;
	target: ScrollNodeLocator;
};

export type DeleteNodeAction = Prettify<
	DeleteFileNodeAction | DeleteSectionNodeAction | DeleteScrollNodeAction
>;

// --- Change Name

export type RenameFileNodeAction = {
	actionType: typeof TreeActionType.RenameNode;
	target: FileNodeLocator;
	newName: NodeName;
};

export type RenameSectionNodeAction = {
	actionType: typeof TreeActionType.RenameNode;
	target: SectionNodeLocator;
	newName: NodeName;
};

export type RenameScrollNodeAction = {
	actionType: typeof TreeActionType.RenameNode;
	target: ScrollNodeLocator;
	newName: NodeName;
};

export type RenameNodeAction = Prettify<
	RenameFileNodeAction | RenameSectionNodeAction | RenameScrollNodeAction
>;

// --- Move

export type MoveFileNodeAction = {
	actionType: typeof TreeActionType.MoveNode;
	target: FileNodeLocator;
	newParent: SectionNodeLocator;
};

export type MoveSectionNodeAction = {
	actionType: typeof TreeActionType.MoveNode;
	target: SectionNodeLocator;
	newParent: SectionNodeLocator;
};

export type MoveScrollNodeAction = {
	actionType: typeof TreeActionType.MoveNode;
	target: ScrollNodeLocator;
	newParent: SectionNodeLocator;
};

export type MoveNodeAction = Prettify<
	MoveFileNodeAction | MoveSectionNodeAction | MoveScrollNodeAction
>;

// --- Change Status

export type ChangeFileNodeStatusAction = {
	actionType: typeof TreeActionType.ChangeNodeStatus;
	target: FileNodeLocator;
	newStatus: FileNode["status"];
};

export type ChangeScrollNodeStatusAction = {
	actionType: typeof TreeActionType.ChangeNodeStatus;
	target: ScrollNodeLocator;
	newStatus: ScrollNode["status"];
};

export type ChangeSectionNodeStatusAction = {
	actionType: typeof TreeActionType.ChangeNodeStatus;
	target: SectionNodeLocator;
	/**
	 * Sections don't store status; this is an instruction to propagate to descendants.
	 */
	newStatus: TreeNodeStatus;
};

export type ChangeNodeStatusAction = Prettify<
	| ChangeFileNodeStatusAction
	| ChangeScrollNodeStatusAction
	| ChangeSectionNodeStatusAction
>;

export type TreeAction = Prettify<
	| CreateTreeNodeAction
	| DeleteNodeAction
	| RenameNodeAction
	| MoveNodeAction
	| ChangeNodeStatusAction
>;
