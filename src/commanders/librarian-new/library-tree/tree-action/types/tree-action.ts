import z from "zod";
import {
	CREATE,
	DELETE,
} from "../../../../../obsidian-vault-action-manager/types/literals";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import type { Prettify } from "../../../../../types/helpers";
import { CHANGE_STATUS, MOVE, RENAME } from "../../../types/consts/literals";
import type { NodeName } from "../../../types/schemas/node-name";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { FileNode, ScrollNode } from "../../tree-node/types/tree-node";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "./target-chains";

export type TreeAction = Prettify<
	| CreateTreeLeafAction
	| DeleteNodeAction
	| RenameNodeAction
	| MoveNodeAction
	| ChangeNodeStatusAction
>;

/**
 * CreateTreeLeafAction represents a semantic creation of a new tree leaf node.
 *
 * If the sections in chain are not present, they are to be silently created.
 */
export type CreateTreeLeafAction = Prettify<
	CreateFileNodeAction | CreateScrollNodeAction
>;

export type DeleteNodeAction = Prettify<
	DeleteFileNodeAction | DeleteSectionNodeAction | DeleteScrollNodeAction
>;

export type RenameNodeAction = Prettify<
	RenameFileNodeAction | RenameSectionNodeAction | RenameScrollNodeAction
>;

/**
 * MoveNodeAction represents a semantic move of an existing tree node
 * to a different parent section.
 *
 * Important distinction:
 * - `target` / `newParent` are **canonical tree locators** and are used
 *   to mutate the LibraryTree (preserve node identity, status, subtree).
 *   `newParent` and it's chain might not exist, but it's locator is canonical.
 * - `target` exists in the tree (otherwise it would be a CreateNodeAction)
 * - `observedVaultSplitPath` is the **observed vault location**
 *   of the node *after the user operation*, and may be non-canonical
 *   (wrong suffixes, wrong folder, etc.).
 *
 * The observed vault split path is **not** used to locate the node in the tree.
 * It exists solely so the Librarian can generate correct healing
 * `VaultAction.rename(from, to)` calls, where `from` must match the
 * actual filesystem state.
 *
 * This separation allows:
 * - enforcing the filename ⇄ path invariant both ways,
 * - preserving node identity and status in the tree,
 * - handling user renames/moves that temporarily violate canonical naming.
 */
export type MoveNodeAction = Prettify<
	MoveFileNodeAction | MoveSectionNodeAction | MoveScrollNodeAction
>;

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

	observedVaultSplitPath: SplitPathToFile;
};

export type CreateScrollNodeAction = {
	actionType: typeof TreeActionType.Create;
	targetLocator: ScrollNodeLocator;
	initialStatus?: ScrollNode["status"];

	observedVaultSplitPath: SplitPathToMdFile;
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

	observedVaultSplitPath: SplitPathToFile;
};

export type MoveSectionNodeAction = {
	actionType: typeof TreeActionType.Move;
	targetLocator: SectionNodeLocator;
	newParentLocator: SectionNodeLocator;
	newNodeName: NodeName;

	observedVaultSplitPath: SplitPathToFolder;
};

export type MoveScrollNodeAction = {
	actionType: typeof TreeActionType.Move;
	targetLocator: ScrollNodeLocator;
	newParentLocator: SectionNodeLocator;
	newNodeName: NodeName;

	observedVaultSplitPath: SplitPathToMdFile;
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
