import { TreeActionType } from "./literals";
import type { CoreName, CoreNameChainFromRoot } from "./split-basename";
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
				coreName: CoreName;
				coreNameChainToParent: CoreNameChainFromRoot;
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
				coreName: CoreName;
				coreNameChainToParent: CoreNameChainFromRoot;
				nodeType: typeof TreeNodeType.File;
				status: typeof TreeNodeStatus.Unknown;
				extension: string;
			};
	  }
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				coreName: CoreName;
				coreNameChainToParent: CoreNameChainFromRoot;
				nodeType: typeof TreeNodeType.Section;
				status:
					| typeof TreeNodeStatus.Done
					| typeof TreeNodeStatus.NotStarted;
			};
	  };

export type DeleteNodeAction = {
	type: typeof TreeActionType.DeleteNode;
	payload: {
		coreNameChain: CoreNameChainFromRoot;
	};
};

export type ChangeNodeNameAction = {
	type: typeof TreeActionType.ChangeNodeName;
	payload: {
		coreNameChain: CoreNameChainFromRoot;
		newCoreName: CoreName;
	};
};

export type ChangeNodeStatusAction = {
	type: typeof TreeActionType.ChangeNodeStatus;
	payload: {
		coreNameChain: CoreNameChainFromRoot;
		newStatus: TreeNodeStatus;
	};
};

export type MoveNodeAction = {
	type: typeof TreeActionType.MoveNode;
	payload: {
		coreNameChain: CoreNameChainFromRoot;
		newCoreNameChainToParent: CoreNameChainFromRoot;
	};
};

export type TreeAction =
	| CreateNodeAction
	| DeleteNodeAction
	| ChangeNodeNameAction
	| ChangeNodeStatusAction
	| MoveNodeAction;
