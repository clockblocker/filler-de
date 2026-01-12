import z from "zod";
import {
	CREATE,
	DELETE,
	RENAME,
} from "../../../../../../../../managers/obsidian/vault-action-manager/types/literals";
import type { Prettify } from "../../../../../../../../types/helpers";
import type { TreeNodeKind } from "../../../../tree-node/types/atoms";
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

export const MaterializedEventKindSchema = z.enum([
	CREATE,
	DELETE,
	RENAME, // vault-level rename/move
]);
export const MaterializedEventKind = MaterializedEventKindSchema.enum;
export type MaterializedEventKind = z.infer<typeof MaterializedEventKindSchema>;

// --- Create

export type CreateFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Create;
	nodeType: typeof TreeNodeKind.File;
	splitPath: SplitPathToFileInsideLibrary;
};

export type CreateScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Create;
	nodeType: typeof TreeNodeKind.Scroll;
	splitPath: SplitPathToMdFileInsideLibrary;
};

// -- Delete

export type DeleteFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Delete;
	nodeType: typeof TreeNodeKind.File;
	splitPath: SplitPathToFileInsideLibrary;
};

export type DeleteScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Delete;
	nodeType: typeof TreeNodeKind.Scroll;
	splitPath: SplitPathToMdFileInsideLibrary;
};

export type DeleteSectionNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Delete;
	nodeType: typeof TreeNodeKind.Section;
	splitPath: SplitPathToFolderInsideLibrary;
};

// --- Rename

export type RenameFileNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Rename;
	nodeType: typeof TreeNodeKind.File;
	from: SplitPathToFileInsideLibrary;
	to: SplitPathToFileInsideLibrary;
};

export type RenameScrollNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Rename;
	nodeType: typeof TreeNodeKind.Scroll;
	from: SplitPathToMdFileInsideLibrary;
	to: SplitPathToMdFileInsideLibrary;
};

export type RenameSectionNodeMaterializedEvent = {
	kind: typeof MaterializedEventKind.Rename;
	nodeType: typeof TreeNodeKind.Section;
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
	kind: typeof MaterializedEventKind.Rename;
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
