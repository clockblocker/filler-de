import z from "zod";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../obsidian-vault-action-manager/types/split-path";
import type { Prettify } from "../../../../../../../types/helpers";
import type { TreeNodeType } from "../../../../tree-node/types/atoms";

/**
 * MaterializedNodeEvent represents a **single-node, inside-Library event**
 * derived from a collapsed & scoped BulkVaultEvent.
 *
 * Invariants:
 * - Exactly **one tree node** per event (no subtrees).
 * - All paths are **library-scoped** (relative to Library root).
 * - Only **leaf nodes** (File | Scroll) are ever created.
 *   Sections are implicit and created by the tree as needed.
 * - `Rename` events are emitted **only for inside→inside** operations
 *   on existing Library nodes.
 * - Outside↔inside transitions are **materialized as Create/Delete**;
 *   no Rename is emitted for boundary-crossing.
 * - No semantic meaning is attached yet (no intent, no canonicalization);
 *   this type is a pure normalization layer.
 */
export type MaterializedNodeEvent = Prettify<
	| CreateFileNodeMaterializedEvent
	| CreateScrollNodeMaterializedEvent
	| DeleteFileNodeMaterializedEvent
	| DeleteScrollNodeMaterializedEvent
	| DeleteSectionNodeMaterializedEvent
	| RenameFileNodeMaterializedEvent
	| RenameScrollNodeMaterializedEvent
	| RenameSectionNodeMaterializedEvent
>;

// --- Materialized Event Type

export const MaterializedEventTypeSchema = z.enum([
	"Create",
	"Delete",
	"Rename", // vault-level rename/move
]);
export const MaterializedEventType = MaterializedEventTypeSchema.enum;
export type MaterializedEventType = z.infer<typeof MaterializedEventTypeSchema>;

// --- Create

export type CreateFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Create;
	nodeType: typeof TreeNodeType.File;
	libraryScopedSplitPath: SplitPathToFile;
};

export type CreateScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Create;
	nodeType: typeof TreeNodeType.Scroll;
	libraryScopedSplitPath: SplitPathToMdFile;
};

export type CreateLeafNodeMaterializedEvent =
	| CreateFileNodeMaterializedEvent
	| CreateScrollNodeMaterializedEvent;

// -- Delete

export type DeleteFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Delete;
	nodeType: typeof TreeNodeType.File;
	libraryScopedSplitPath: SplitPathToFile;
};

export type DeleteScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Delete;
	nodeType: typeof TreeNodeType.Scroll;
	libraryScopedSplitPath: SplitPathToMdFile;
};

export type DeleteSectionNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Delete;
	nodeType: typeof TreeNodeType.Section;
	libraryScopedSplitPath: SplitPathToFolder;
};

// --- Rename

export type RenameFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Rename;
	nodeType: typeof TreeNodeType.File;
	libraryScopedFrom: SplitPathToFile;
	libraryScopedTo: SplitPathToFile;
};

export type RenameScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Rename;
	nodeType: typeof TreeNodeType.Scroll;
	libraryScopedFrom: SplitPathToMdFile;
	libraryScopedTo: SplitPathToMdFile;
};

export type RenameSectionNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Rename;
	nodeType: typeof TreeNodeType.Section;
	libraryScopedFrom: SplitPathToFolder;
	libraryScopedTo: SplitPathToFolder;
};

export type RenameTreeNodeNodeMaterializedEvent =
	| RenameFileNodeMaterializedEvent
	| RenameScrollNodeMaterializedEvent
	| RenameSectionNodeMaterializedEvent;
