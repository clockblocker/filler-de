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
export type {
	NodeName,
	NodeNameChain,
	SplitSuffix,
} from "./naming/types/node-name";
export {
	DragInSubtype,
	HealingMode,
	RuntimeSubtype,
} from "./types/literals";
export type { TreeAction } from "./types/tree-action";
export type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeLeaf,
	TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "./types/tree-node";
export { findCommonAncestor } from "./utils/find-common-ancestor";
