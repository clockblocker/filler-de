import type { NodeName, NodeNameChain } from "../naming/parsed-basename";
import { TreeActionType } from "./literals";
import type { TreeNodeStatus, TreeNodeType } from "./tree-node";

export { TreeActionType };

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
