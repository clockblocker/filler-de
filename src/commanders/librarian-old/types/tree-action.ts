import type { NodeNameChainDeprecated } from "..";
import { TreeActionType } from "./literals";
import type { NodeNameDeprecated } from "./schemas/node-name";
import type {
	TreeNodeStatusDeprecated,
	TreeNodeTypeDeprecated,
} from "./tree-node";

export { TreeActionType };

/**
 * CreateNodeAction for Scroll or File nodes.
 * Note: tRef is NOT stored - TFile references become stale when files are renamed/moved.
 * TFile references are resolved on-demand when file I/O is needed.
 */
export type CreateNodeActionDeprecated =
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				nodeName: NodeNameDeprecated;
				nodeNameChainToParent: NodeNameChainDeprecated;
				nodeType: typeof TreeNodeTypeDeprecated.Scroll;
				status:
					| typeof TreeNodeStatusDeprecated.Done
					| typeof TreeNodeStatusDeprecated.NotStarted;
				extension: "md";
			};
	  }
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				nodeName: NodeNameDeprecated;
				nodeNameChainToParent: NodeNameChainDeprecated;
				nodeType: typeof TreeNodeTypeDeprecated.File;
				status: typeof TreeNodeStatusDeprecated.Unknown;
				extension: string;
			};
	  }
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				nodeName: NodeNameDeprecated;
				nodeNameChainToParent: NodeNameChainDeprecated;
				nodeType: typeof TreeNodeTypeDeprecated.Section;
				status:
					| typeof TreeNodeStatusDeprecated.Done
					| typeof TreeNodeStatusDeprecated.NotStarted;
			};
	  };

export type DeleteNodeActionDeprecated = {
	type: typeof TreeActionType.DeleteNode;
	payload: {
		nodeNameChain: NodeNameChainDeprecated;
	};
};

export type ChangeNodeNameActionDeprecated = {
	type: typeof TreeActionType.ChangeNodeName;
	payload: {
		nodeNameChain: NodeNameChainDeprecated;
		newNodeName: NodeNameDeprecated;
	};
};

export type ChangeNodeStatusActionDeprecated = {
	type: typeof TreeActionType.ChangeNodeStatus;
	payload: {
		nodeNameChain: NodeNameChainDeprecated;
		newStatus: TreeNodeStatusDeprecated;
	};
};

export type MoveNodeActionDeprecated = {
	type: typeof TreeActionType.MoveNode;
	payload: {
		nodeNameChain: NodeNameChainDeprecated;
		newNodeNameChainToParent: NodeNameChainDeprecated;
	};
};

export type TreeActionDeprecated =
	| CreateNodeActionDeprecated
	| DeleteNodeActionDeprecated
	| ChangeNodeNameActionDeprecated
	| ChangeNodeStatusActionDeprecated
	| MoveNodeActionDeprecated;
