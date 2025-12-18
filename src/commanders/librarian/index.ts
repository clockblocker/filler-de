// Click handler
export {
	handleCodexCheckboxClick,
	isTaskCheckbox,
	parseCodexLinkTarget,
} from "./click-handler";
// Healing exports
export {
	type DragInResult,
	detectRenameMode,
	type EventMode,
	handleDragIn,
	healOnInit,
	type InitHealResult,
	type RenameIntent,
	resolveRuntimeIntent,
} from "./healing";
export { Librarian } from "./librarian";
export { LibraryTree } from "./library-tree";
export {
	DragInSubtype,
	HealingMode,
	RuntimeSubtype,
} from "./types/literals";
export type {
	CoreName,
	CoreNameChainFromRoot,
	SplitBasename,
} from "./types/split-basename";
export type { TreeAction } from "./types/tree-action";
export type { TreeLeaf } from "./types/tree-leaf";
export type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "./types/tree-node";
export { findCommonAncestor } from "./utils/find-common-ancestor";
