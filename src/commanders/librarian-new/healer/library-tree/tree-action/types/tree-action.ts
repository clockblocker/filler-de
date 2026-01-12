import z from "zod";
import {
	CREATE,
	DELETE,
} from "../../../../../../managers/obsidian/vault-action-manager/types/literals";
import type { Prettify } from "../../../../../../types/helpers";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "../../../../codecs/locator/types";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../codecs/split-path-inside-library/types/generic-split-path-inside-library-of";
import { CHANGE_STATUS, MOVE, RENAME } from "../../../../types/consts/literals";
import type { NodeName } from "../../../../types/schemas/node-name";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { FileNode, ScrollNode } from "../../tree-node/types/tree-node";

export type TreeAction = Prettify<
	| CreateTreeLeafAction
	| DeleteNodeAction
	| RenameNodeAction
	| MoveNodeAction
	| ChangeNodeStatusAction
>;

/**
 * A semantic "create leaf" Tree action (File | Scroll).
 *
 * Meaning:
 * - A new leaf node is introduced into the LibraryTree at `targetLocator`.
 * - Any missing sections along `targetLocator.segmentIdChainToParent`
 *   must be created implicitly by the tree.
 *
 * Notes:
 * - Sections are never created directly by events; they emerge from leaf placement.
 * - `observedVaultSplitPath` is the post-op vault location (may be non-canonical),
 *   used later for healing `VaultAction.rename(fromObserved, toCanonical)`.
 */
export type CreateTreeLeafAction = Prettify<
	CreateFileNodeAction | CreateScrollNodeAction
>;

/**
 * A semantic "delete node" Tree action (File | Scroll | Section).
 *
 * Meaning:
 * - The node identified by `targetLocator` is removed from the LibraryTree.
 *
 * Notes:
 * - For section deletes, the Tree is responsible for deleting the entire subtree.
 * - No filesystem path is carried here: deletion targets are identified purely
 *   by canonical tree locators.
 * - Any healing or vault-side cleanup is handled later by the Librarian.
 */
export type DeleteNodeAction = Prettify<
	DeleteFileNodeAction | DeleteSectionNodeAction | DeleteScrollNodeAction
>;

/**
 * A semantic "rename node" Tree action (File | Scroll | Section).
 *
 * Meaning:
 * - The node identified by `targetLocator` keeps its position in the tree,
 *   but its `nodeName` is changed to `newNodeName`.
 *
 * Notes:
 * - This action represents a **pure rename** with no change in parent section.
 * - Guaranteed to be a valid NodeName → NodeName transformation.
 * - All breaking suffix-related issues are handled as MOVES or DELETES, not renames.
 * - Any suffix or descendant updates required to maintain invariants
 *   are handled later during tree application / healing.
 * - If a rename implies a parent change, a `MoveNodeAction` is emitted instead.
 */
export type RenameNodeAction = Prettify<
	RenameFileNodeAction | RenameSectionNodeAction | RenameScrollNodeAction
>;

/**
 * A semantic "move node" Tree action (File | Scroll | Section).
 *
 * Meaning:
 * - The node identified by `targetLocator` is moved under `newParentLocator`
 *   and renamed to `newNodeName` in a single semantic operation.
 *
 * Notes:
 * - `targetLocator` refers to the node’s **current canonical location** in the tree.
 * - `newParentLocator` refers to the **canonical destination parent section**.
 *   This section (and its ancestor chain) **may not exist yet** and must be
 *   created implicitly by the tree before the move is applied.
 * - `observedVaultSplitPath` is the **actual vault path after the user operation**
 *   and may be non-canonical (wrong suffixes, wrong folders, etc.).
 *
 * Important:
 * - The observed vault split path is **never** used to locate the node in the tree.
 * - It exists solely to generate correct healing `VaultAction.rename(from, to)`
 *   calls, where `from` must match the real filesystem state.
 *
 * This separation allows:
 * - enforcing the filename ⇄ path invariant both ways,
 * - preserving node identity and status across moves,
 * - handling user renames/moves that temporarily violate canonical naming.
 */
export type MoveNodeAction = Prettify<
	MoveFileNodeAction | MoveSectionNodeAction | MoveScrollNodeAction
>;

/**
 * A semantic "change node status" Tree action (File | Scroll | Section).
 *
 * Meaning:
 * - Updates the status of the node identified by `targetLocator`.
 *
 * Notes:
 * - For File and Scroll nodes, the status is stored directly on the node.
 * - For Section nodes, no status is stored on the section itself;
 *   `newStatus` is interpreted as an instruction to **propagate** the status
 *   to all descendant leaf nodes.
 *
 * This action does not affect node structure or location and is handled
 * entirely within the tree.
 */
export type ChangeNodeStatusAction = Prettify<
	| ChangeFileNodeStatusAction
	| ChangeScrollNodeStatusAction
	| ChangeSectionNodeStatusAction
>;

const TreeActionTypeSchema = z.enum([
	CREATE,
	DELETE,
	RENAME,
	CHANGE_STATUS,
	MOVE,
]);

export type TreeActionType = z.infer<typeof TreeActionTypeSchema>;
export const TreeActionType = TreeActionTypeSchema.enum;

// --- Create

export type CreateFileNodeAction = {
	actionType: typeof TreeActionType.Create;
	targetLocator: FileNodeLocator;
	initialStatus?: FileNode["status"];

	observedSplitPath: SplitPathToFileInsideLibrary;
};

export type CreateScrollNodeAction = {
	actionType: typeof TreeActionType.Create;
	targetLocator: ScrollNodeLocator;
	initialStatus?: ScrollNode["status"];

	observedSplitPath: SplitPathToMdFileInsideLibrary;
};

// --- Delete

export type DeleteFileNodeAction = {
	actionType: typeof TreeActionType.Delete;
	targetLocator: FileNodeLocator;
};

export type DeleteSectionNodeAction = {
	actionType: typeof TreeActionType.Delete;
	targetLocator: SectionNodeLocator;
};

export type DeleteScrollNodeAction = {
	actionType: typeof TreeActionType.Delete;
	targetLocator: ScrollNodeLocator;
};

// --- Change Name

export type RenameFileNodeAction = {
	actionType: typeof TreeActionType.Rename;
	targetLocator: FileNodeLocator;
	newNodeName: NodeName;
};

export type RenameSectionNodeAction = {
	actionType: typeof TreeActionType.Rename;
	targetLocator: SectionNodeLocator;
	newNodeName: NodeName;
};

export type RenameScrollNodeAction = {
	actionType: typeof TreeActionType.Rename;
	targetLocator: ScrollNodeLocator;
	newNodeName: NodeName;
};

// --- Move

export type MoveFileNodeAction = {
	actionType: typeof TreeActionType.Move;
	targetLocator: FileNodeLocator;
	newParentLocator: SectionNodeLocator;
	newNodeName: NodeName;

	observedSplitPath: SplitPathToFileInsideLibrary;
};

export type MoveSectionNodeAction = {
	actionType: typeof TreeActionType.Move;
	targetLocator: SectionNodeLocator;
	newParentLocator: SectionNodeLocator;
	newNodeName: NodeName;

	observedSplitPath: SplitPathToFolderInsideLibrary;
};

export type MoveScrollNodeAction = {
	actionType: typeof TreeActionType.Move;
	targetLocator: ScrollNodeLocator;
	newParentLocator: SectionNodeLocator;
	newNodeName: NodeName;

	observedSplitPath: SplitPathToMdFileInsideLibrary;
};

// --- Change Status

export type ChangeFileNodeStatusAction = {
	actionType: typeof TreeActionType.ChangeStatus;
	targetLocator: FileNodeLocator;
	newStatus: FileNode["status"];
};

export type ChangeScrollNodeStatusAction = {
	actionType: typeof TreeActionType.ChangeStatus;
	targetLocator: ScrollNodeLocator;
	newStatus: ScrollNode["status"];
};

export type ChangeSectionNodeStatusAction = {
	actionType: typeof TreeActionType.ChangeStatus;
	targetLocator: SectionNodeLocator;
	/**
	 * Sections don't store status; this is an instruction to propagate to descendants.
	 */
	newStatus: TreeNodeStatus;
};
