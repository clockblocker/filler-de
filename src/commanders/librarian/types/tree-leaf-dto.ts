import type { TFile } from "obsidian";
import type { SplitPath } from "../../../../obsidian-vault-action-manager/types/split-path";
import type {
	CoreName,
	CoreNameChainFromRoot,
	FileNode,
	ScrollNode,
} from "./tree-node";

export type TreeLeafDto = (ScrollNode | FileNode) &
	Pick<SplitPath, "pathParts">;
