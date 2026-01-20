/**
 * Materialized Event Helpers - Utility functions for working with MaterializedNodeEvents.
 *
 * This module provides helper functions that eliminate the need for switch
 * statements when working with materialized events. Also provides the crucial
 * mapping between SplitPathKind and TreeNodeKind.
 *
 * Benefits:
 * - Single source of truth for SplitPathKind → TreeNodeKind mapping
 * - Type-safe event classification
 * - Visitor pattern for exhaustive handling
 */

import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { TreeNodeKind } from "../../../../../tree-node/types/atoms";
import {
	type CreateFileNodeMaterializedEvent,
	type CreateLeafNodeMaterializedEvent,
	type CreateScrollNodeMaterializedEvent,
	type DeleteFileNodeMaterializedEvent,
	type DeleteScrollNodeMaterializedEvent,
	type DeleteSectionNodeMaterializedEvent,
	type DeleteTreeNodeMaterializedEvent,
	MaterializedEventKind,
	type MaterializedNodeEvent,
	type RenameFileNodeMaterializedEvent,
	type RenameScrollNodeMaterializedEvent,
	type RenameSectionNodeMaterializedEvent,
	type RenameTreeNodeNodeMaterializedEvent,
} from "../types";

// ─── SplitPathKind ↔ TreeNodeKind Mapping ───

/**
 * Maps SplitPathKind to the corresponding TreeNodeKind.
 * This is the single source of truth for this conversion.
 *
 * - File (non-md) → File
 * - MdFile → Scroll
 * - Folder → Section
 */
export const SPLIT_PATH_KIND_TO_TREE_NODE_KIND: Record<
	SplitPathKind,
	TreeNodeKind
> = {
	[SplitPathKind.File]: TreeNodeKind.File,
	[SplitPathKind.MdFile]: TreeNodeKind.Scroll,
	[SplitPathKind.Folder]: TreeNodeKind.Section,
};

/**
 * Convert SplitPathKind to TreeNodeKind.
 */
export function splitPathKindToTreeNodeKind(kind: SplitPathKind): TreeNodeKind {
	return SPLIT_PATH_KIND_TO_TREE_NODE_KIND[kind];
}

/**
 * Get TreeNodeKind from a split path.
 */
export function getTreeNodeKindForSplitPath(sp: AnySplitPath): TreeNodeKind {
	return splitPathKindToTreeNodeKind(sp.kind);
}

/**
 * Check if split path represents a leaf node (File or Scroll).
 */
export function isLeafSplitPath(
	sp: AnySplitPath,
): sp is SplitPathToFile | SplitPathToMdFile {
	return sp.kind === SplitPathKind.File || sp.kind === SplitPathKind.MdFile;
}

/**
 * Get TreeNodeKind for leaf split paths only.
 * Returns null for folders.
 */
export function getLeafNodeKind(
	sp: AnySplitPath,
): typeof TreeNodeKind.File | typeof TreeNodeKind.Scroll | null {
	switch (sp.kind) {
		case SplitPathKind.File:
			return TreeNodeKind.File;
		case SplitPathKind.MdFile:
			return TreeNodeKind.Scroll;
		case SplitPathKind.Folder:
			return null;
	}
}

// ─── Operation Classification ───

/**
 * Check if event is a Create event.
 */
export function isMaterializedCreateEvent(
	event: MaterializedNodeEvent,
): event is CreateLeafNodeMaterializedEvent {
	return event.kind === MaterializedEventKind.Create;
}

/**
 * Check if event is a Delete event.
 */
export function isMaterializedDeleteEvent(
	event: MaterializedNodeEvent,
): event is DeleteTreeNodeMaterializedEvent {
	return event.kind === MaterializedEventKind.Delete;
}

/**
 * Check if event is a Rename event.
 */
export function isMaterializedRenameEvent(
	event: MaterializedNodeEvent,
): event is RenameTreeNodeNodeMaterializedEvent {
	return event.kind === MaterializedEventKind.Rename;
}

// ─── Node Kind Classification ───

/**
 * Check if event operates on a File node.
 */
export function isFileNodeEvent(
	event: MaterializedNodeEvent,
): event is
	| CreateFileNodeMaterializedEvent
	| DeleteFileNodeMaterializedEvent
	| RenameFileNodeMaterializedEvent {
	return event.nodeKind === TreeNodeKind.File;
}

/**
 * Check if event operates on a Scroll node.
 */
export function isScrollNodeEvent(
	event: MaterializedNodeEvent,
): event is
	| CreateScrollNodeMaterializedEvent
	| DeleteScrollNodeMaterializedEvent
	| RenameScrollNodeMaterializedEvent {
	return event.nodeKind === TreeNodeKind.Scroll;
}

/**
 * Check if event operates on a Section node.
 */
export function isSectionNodeEvent(
	event: MaterializedNodeEvent,
): event is
	| DeleteSectionNodeMaterializedEvent
	| RenameSectionNodeMaterializedEvent {
	return event.nodeKind === TreeNodeKind.Section;
}

/**
 * Check if event operates on a leaf node (File or Scroll).
 */
export function isLeafNodeEvent(
	event: MaterializedNodeEvent,
): event is
	| CreateFileNodeMaterializedEvent
	| CreateScrollNodeMaterializedEvent
	| DeleteFileNodeMaterializedEvent
	| DeleteScrollNodeMaterializedEvent
	| RenameFileNodeMaterializedEvent
	| RenameScrollNodeMaterializedEvent {
	return (
		event.nodeKind === TreeNodeKind.File ||
		event.nodeKind === TreeNodeKind.Scroll
	);
}

// ─── Specific Event Type Guards ───

// Create events
export function isCreateFileEvent(
	event: MaterializedNodeEvent,
): event is CreateFileNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Create &&
		event.nodeKind === TreeNodeKind.File
	);
}

export function isCreateScrollEvent(
	event: MaterializedNodeEvent,
): event is CreateScrollNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Create &&
		event.nodeKind === TreeNodeKind.Scroll
	);
}

// Delete events
export function isDeleteFileEvent(
	event: MaterializedNodeEvent,
): event is DeleteFileNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Delete &&
		event.nodeKind === TreeNodeKind.File
	);
}

export function isDeleteScrollEvent(
	event: MaterializedNodeEvent,
): event is DeleteScrollNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Delete &&
		event.nodeKind === TreeNodeKind.Scroll
	);
}

export function isDeleteSectionEvent(
	event: MaterializedNodeEvent,
): event is DeleteSectionNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Delete &&
		event.nodeKind === TreeNodeKind.Section
	);
}

// Rename events
export function isRenameFileEvent(
	event: MaterializedNodeEvent,
): event is RenameFileNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Rename &&
		event.nodeKind === TreeNodeKind.File
	);
}

export function isRenameScrollEvent(
	event: MaterializedNodeEvent,
): event is RenameScrollNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Rename &&
		event.nodeKind === TreeNodeKind.Scroll
	);
}

export function isRenameSectionEvent(
	event: MaterializedNodeEvent,
): event is RenameSectionNodeMaterializedEvent {
	return (
		event.kind === MaterializedEventKind.Rename &&
		event.nodeKind === TreeNodeKind.Section
	);
}

// ─── Visitor Pattern ───

/**
 * Handler functions for the materialized event visitor pattern.
 * Organized by operation type × node kind.
 */
export type MaterializedEventVisitor<T> = {
	// Create (leaf only - no CreateSection)
	CreateFile: (event: CreateFileNodeMaterializedEvent) => T;
	CreateScroll: (event: CreateScrollNodeMaterializedEvent) => T;
	// Delete (all node kinds)
	DeleteFile: (event: DeleteFileNodeMaterializedEvent) => T;
	DeleteScroll: (event: DeleteScrollNodeMaterializedEvent) => T;
	DeleteSection: (event: DeleteSectionNodeMaterializedEvent) => T;
	// Rename (all node kinds)
	RenameFile: (event: RenameFileNodeMaterializedEvent) => T;
	RenameScroll: (event: RenameScrollNodeMaterializedEvent) => T;
	RenameSection: (event: RenameSectionNodeMaterializedEvent) => T;
};

/**
 * Visit a materialized event with type-safe exhaustive handling.
 */
export function visitMaterializedEvent<T>(
	event: MaterializedNodeEvent,
	visitor: MaterializedEventVisitor<T>,
): T {
	switch (event.kind) {
		case MaterializedEventKind.Create:
			switch (event.nodeKind) {
				case TreeNodeKind.File:
					return visitor.CreateFile(event);
				case TreeNodeKind.Scroll:
					return visitor.CreateScroll(event);
			}
			break;

		case MaterializedEventKind.Delete:
			switch (event.nodeKind) {
				case TreeNodeKind.File:
					return visitor.DeleteFile(event);
				case TreeNodeKind.Scroll:
					return visitor.DeleteScroll(event);
				case TreeNodeKind.Section:
					return visitor.DeleteSection(event);
			}
			break;

		case MaterializedEventKind.Rename:
			switch (event.nodeKind) {
				case TreeNodeKind.File:
					return visitor.RenameFile(event);
				case TreeNodeKind.Scroll:
					return visitor.RenameScroll(event);
				case TreeNodeKind.Section:
					return visitor.RenameSection(event);
			}
	}
}

/**
 * Simplified visitor for when you only need operation-level handling.
 */
export type MaterializedOperationVisitor<T> = {
	Create: (event: CreateLeafNodeMaterializedEvent) => T;
	Delete: (event: DeleteTreeNodeMaterializedEvent) => T;
	Rename: (event: RenameTreeNodeNodeMaterializedEvent) => T;
};

/**
 * Visit a materialized event by operation type only.
 */
export function visitMaterializedOperation<T>(
	event: MaterializedNodeEvent,
	visitor: MaterializedOperationVisitor<T>,
): T {
	switch (event.kind) {
		case MaterializedEventKind.Create:
			return visitor.Create(event);
		case MaterializedEventKind.Delete:
			return visitor.Delete(event);
		case MaterializedEventKind.Rename:
			return visitor.Rename(event);
	}
}

// ─── Namespace Export ───

export const MaterializedEventHelpers = {
	getLeafNodeKind,
	getTreeNodeKindForSplitPath,

	// Specific type guards
	isCreateFileEvent,
	isCreateScrollEvent,
	isDeleteFileEvent,
	isDeleteScrollEvent,
	isDeleteSectionEvent,

	// Node kind classification
	isFileNodeEvent,
	isLeafNodeEvent,
	isLeafSplitPath,

	// Operation classification
	isMaterializedCreateEvent,
	isMaterializedDeleteEvent,
	isMaterializedRenameEvent,
	isRenameFileEvent,
	isRenameScrollEvent,
	isRenameSectionEvent,
	isScrollNodeEvent,
	isSectionNodeEvent,
	// SplitPathKind ↔ TreeNodeKind mapping
	SPLIT_PATH_KIND_TO_TREE_NODE_KIND,
	splitPathKindToTreeNodeKind,

	// Visitor pattern
	visitMaterializedEvent,
	visitMaterializedOperation,
};
