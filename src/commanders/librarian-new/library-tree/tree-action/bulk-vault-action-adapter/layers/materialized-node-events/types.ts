import z from "zod";
import {
	CREATE,
	DELETE,
	RENAME,
} from "../../../../../../../managers/obsidian/vault-action-manager/types/literals";
import type { Prettify } from "../../../../../../../types/helpers";
import type { TreeNodeType } from "../../../../tree-node/types/atoms";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "../../../types/target-chains";
import type {
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../utils/canonical-naming/types";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../library-scope/types/inside-library-split-paths";

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
	| DeleteTreeNodeMaterializedEvent
	| RenameTreeNodeNodeMaterializedEvent
	| CreateLeafNodeMaterializedEvent
	| LeafMaterializedEvent
	| SectionMaterializedEvent
>;

// --- Materialized Event Type

export const MaterializedEventTypeSchema = z.enum([
	CREATE,
	DELETE,
	RENAME, // vault-level rename/move
]);
export const MaterializedEventType = MaterializedEventTypeSchema.enum;
export type MaterializedEventType = z.infer<typeof MaterializedEventTypeSchema>;

// --- Create

export type CreateFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Create;
	nodeType: typeof TreeNodeType.File;
	splitPath: SplitPathToFileInsideLibrary;
};

export type CreateScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Create;
	nodeType: typeof TreeNodeType.Scroll;
	splitPath: SplitPathToMdFileInsideLibrary;
};

// -- Delete

export type DeleteFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Delete;
	nodeType: typeof TreeNodeType.File;
	splitPath: SplitPathToFileInsideLibrary;
};

export type DeleteScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Delete;
	nodeType: typeof TreeNodeType.Scroll;
	splitPath: SplitPathToMdFileInsideLibrary;
};

export type DeleteSectionNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Delete;
	nodeType: typeof TreeNodeType.Section;
	splitPath: SplitPathToFolderInsideLibrary;
};

// --- Rename

export type RenameFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Rename;
	nodeType: typeof TreeNodeType.File;
	from: SplitPathToFileInsideLibrary;
	to: SplitPathToFileInsideLibrary;
};

export type RenameScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Rename;
	nodeType: typeof TreeNodeType.Scroll;
	from: SplitPathToMdFileInsideLibrary;
	to: SplitPathToMdFileInsideLibrary;
};

export type RenameSectionNodeMaterializedEvent = {
	kind: typeof MaterializedEventType.Rename;
	nodeType: typeof TreeNodeType.Section;
	from: SplitPathToFolderInsideLibrary;
	to: SplitPathToFolderInsideLibrary;
};

// -- Gropped By Event Type

export type CreateLeafNodeMaterializedEvent =
	| CreateFileNodeMaterializedEvent
	| CreateScrollNodeMaterializedEvent;

export type DeleteTreeNodeMaterializedEvent =
	| DeleteFileNodeMaterializedEvent
	| DeleteScrollNodeMaterializedEvent
	| DeleteSectionNodeMaterializedEvent;

export type RenameTreeNodeNodeMaterializedEvent =
	| RenameFileNodeMaterializedEvent
	| RenameScrollNodeMaterializedEvent
	| RenameSectionNodeMaterializedEvent;

// -- Gropped by File Type

export type LeafMaterializedEvent =
	| CreateFileNodeMaterializedEvent
	| CreateScrollNodeMaterializedEvent
	| DeleteFileNodeMaterializedEvent
	| DeleteScrollNodeMaterializedEvent
	| RenameFileNodeMaterializedEvent
	| RenameScrollNodeMaterializedEvent;

export type SectionMaterializedEvent =
	| DeleteSectionNodeMaterializedEvent
	| RenameSectionNodeMaterializedEvent;

type TargetObservedSplitPath<E extends MaterializedNodeEvent> = E extends {
	kind: typeof MaterializedEventType.Rename;
}
	? E extends LeafMaterializedEvent
		? E["to"]
		: E extends SectionMaterializedEvent
			? E["to"]
			: never
	: E extends { splitPath: unknown }
		? E["splitPath"]
		: never;

type CanonicalForObserved<SP> = SP extends SplitPathToFolderInsideLibrary
	? CanonicalSplitPathToFolderInsideLibrary
	: SP extends SplitPathToMdFileInsideLibrary
		? CanonicalSplitPathToMdFileInsideLibrary
		: SP extends SplitPathToFileInsideLibrary
			? CanonicalSplitPathToFileInsideLibrary
			: never;

export type CanonicalSplitPathToDestination<E extends MaterializedNodeEvent> =
	CanonicalForObserved<TargetObservedSplitPath<E>>;

type LocatorForObserved<SP> = SP extends SplitPathToFolderInsideLibrary
	? SectionNodeLocator
	: SP extends SplitPathToMdFileInsideLibrary
		? ScrollNodeLocator
		: SP extends SplitPathToFileInsideLibrary
			? FileNodeLocator
			: never;

export type TreeNodeLocatorForEvent<E extends MaterializedNodeEvent> =
	LocatorForObserved<TargetObservedSplitPath<E>>;

export type TreeNodeLocatorForLibraryScopedSplitPath<
	SP extends SplitPathInsideLibrary,
> = LocatorForObserved<SP>;
