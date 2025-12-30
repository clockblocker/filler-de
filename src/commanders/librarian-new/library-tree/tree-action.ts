import z from "zod";
import type { NodeNameChain } from "../..";
import {
	CHANGE_NODE_NAME_ACTION,
	CHANGE_NODE_STATUS_ACTION,
	CREATE_NODE_ACTION,
	DELETE_NODE_ACTION,
	MOVE_NODE_ACTION,
} from "../types/consts/literals";
import type { NodeName } from "../types/schemas/node-name";
import type { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";

const TreeActionTypeSchema = z.enum([
	CREATE_NODE_ACTION,
	DELETE_NODE_ACTION,
	CHANGE_NODE_NAME_ACTION,
	CHANGE_NODE_STATUS_ACTION,
	MOVE_NODE_ACTION,
]);
export type TreeActionType = z.infer<typeof TreeActionTypeSchema>;
export const TreeActionType = TreeActionTypeSchema.enum;

/**
 * CreateNodeAction for Scroll or File nodes.
 * Note: tRef is NOT stored - TFile references become stale when files are renamed/moved.
 * TFile references are resolved on-demand when file I/O is needed.
 */
export type CreateNodeAction =
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				nodeName: NodeName;
				nodeNameChainToParent: NodeNameChain;
				nodeType: typeof TreeNodeType.Scroll;
				status:
					| typeof TreeNodeStatus.Done
					| typeof TreeNodeStatus.NotStarted;
				extension: "md";
			};
	  }
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				nodeName: NodeName;
				nodeNameChainToParent: NodeNameChain;
				nodeType: typeof TreeNodeType.File;
				status: typeof TreeNodeStatus.Unknown;
				extension: string;
			};
	  }
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				nodeName: NodeName;
				nodeNameChainToParent: NodeNameChain;
				nodeType: typeof TreeNodeType.Section;
				status:
					| typeof TreeNodeStatus.Done
					| typeof TreeNodeStatus.NotStarted;
			};
	  };

export type DeleteNodeAction = {
	type: typeof TreeActionType.DeleteNode;
	payload: {
		nodeNameChain: NodeNameChain;
	};
};

export type ChangeNodeNameAction = {
	type: typeof TreeActionType.ChangeNodeName;
	payload: {
		nodeNameChain: NodeNameChain;
		newNodeName: NodeName;
	};
};

export type ChangeNodeStatusAction = {
	type: typeof TreeActionType.ChangeNodeStatus;
	payload: {
		nodeNameChain: NodeNameChain;
		newStatus: TreeNodeStatus;
	};
};

export type MoveNodeAction = {
	type: typeof TreeActionType.MoveNode;
	payload: {
		nodeNameChain: NodeNameChain;
		newNodeNameChainToParent: NodeNameChain;
	};
};

export type TreeAction =
	| CreateNodeAction
	| DeleteNodeAction
	| ChangeNodeNameAction
	| ChangeNodeStatusAction
	| MoveNodeAction;
