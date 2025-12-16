import type { TFile } from "obsidian";
import { TreeActionType } from "./literals";
import type { CoreName, CoreNameChainFromRoot } from "./split-basename";
import type { TreeNodeStatus, TreeNodeType } from "./tree-node";

export { TreeActionType };

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
				tRef: TFile;
			};
	  }
	| {
			type: typeof TreeActionType.CreateNode;
			payload: {
				coreName: CoreName;
				coreNameChainToParent: CoreNameChainFromRoot;
				nodeType: typeof TreeNodeType.File;
				status: typeof TreeNodeStatus.Unknown;
				tRef: TFile;
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

export type TreeAction =
	| CreateNodeAction
	| DeleteNodeAction
	| ChangeNodeNameAction
	| ChangeNodeStatusAction;
