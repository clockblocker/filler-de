/**
 * Event Helpers - Utility functions for working with VaultEvents.
 *
 * This module provides helper functions that eliminate the need for
 * switch statements when working with VaultEvents. The 6-case union
 * requires switches in 6+ places; these helpers consolidate that logic.
 *
 * Benefits:
 * - Single place to update when event types change
 * - Type-safe narrowing without manual switches
 * - Consistent path extraction logic
 * - Visitor pattern for exhaustive handling
 * - Easier testing and maintenance
 */

import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import { SplitPathKind } from "../types/split-path";
import {
	type FileCreatedVaultEvent,
	type FileDeletedVaultEvent,
	type FileRenamedVaultEvent,
	type FolderCreatedVaultEvent,
	type FolderDeletedVaultEvent,
	type FolderRenamedVaultEvent,
	type VaultEvent,
	VaultEventKind,
} from "../types/vault-event";

// ─── Operation Classification ───

/**
 * Check if event represents a creation.
 */
export function isCreateEvent(
	event: VaultEvent,
): event is FileCreatedVaultEvent | FolderCreatedVaultEvent {
	return (
		event.kind === VaultEventKind.FileCreated ||
		event.kind === VaultEventKind.FolderCreated
	);
}

/**
 * Check if event represents a deletion.
 */
export function isDeleteEvent(
	event: VaultEvent,
): event is FileDeletedVaultEvent | FolderDeletedVaultEvent {
	return (
		event.kind === VaultEventKind.FileDeleted ||
		event.kind === VaultEventKind.FolderDeleted
	);
}

/**
 * Check if event represents a rename/move.
 */
export function isRenameEvent(
	event: VaultEvent,
): event is FileRenamedVaultEvent | FolderRenamedVaultEvent {
	return (
		event.kind === VaultEventKind.FileRenamed ||
		event.kind === VaultEventKind.FolderRenamed
	);
}

// ─── Target Type Classification ───

/**
 * Check if event operates on a folder.
 */
export function isFolderEvent(
	event: VaultEvent,
): event is
	| FolderCreatedVaultEvent
	| FolderDeletedVaultEvent
	| FolderRenamedVaultEvent {
	return (
		event.kind === VaultEventKind.FolderCreated ||
		event.kind === VaultEventKind.FolderDeleted ||
		event.kind === VaultEventKind.FolderRenamed
	);
}

/**
 * Check if event operates on a file (md or non-md).
 */
export function isFileEvent(
	event: VaultEvent,
): event is
	| FileCreatedVaultEvent
	| FileDeletedVaultEvent
	| FileRenamedVaultEvent {
	return (
		event.kind === VaultEventKind.FileCreated ||
		event.kind === VaultEventKind.FileDeleted ||
		event.kind === VaultEventKind.FileRenamed
	);
}

// ─── Individual Event Type Guards ───

export function isFileCreatedEvent(
	event: VaultEvent,
): event is FileCreatedVaultEvent {
	return event.kind === VaultEventKind.FileCreated;
}

export function isFileDeletedEvent(
	event: VaultEvent,
): event is FileDeletedVaultEvent {
	return event.kind === VaultEventKind.FileDeleted;
}

export function isFileRenamedEvent(
	event: VaultEvent,
): event is FileRenamedVaultEvent {
	return event.kind === VaultEventKind.FileRenamed;
}

export function isFolderCreatedEvent(
	event: VaultEvent,
): event is FolderCreatedVaultEvent {
	return event.kind === VaultEventKind.FolderCreated;
}

export function isFolderDeletedEvent(
	event: VaultEvent,
): event is FolderDeletedVaultEvent {
	return event.kind === VaultEventKind.FolderDeleted;
}

export function isFolderRenamedEvent(
	event: VaultEvent,
): event is FolderRenamedVaultEvent {
	return event.kind === VaultEventKind.FolderRenamed;
}

// ─── Path Extraction ───

/**
 * Get the primary split path from an event.
 * For rename events, returns the 'from' path.
 * For create/delete events, returns the splitPath.
 */
export function getEventSplitPath(event: VaultEvent): AnySplitPath {
	if (isRenameEvent(event)) {
		return event.from;
	}
	return event.splitPath;
}

/**
 * Get the destination split path from a rename event.
 * Returns undefined for non-rename events.
 */
export function getEventToSplitPath(
	event: VaultEvent,
): AnySplitPath | undefined {
	if (isRenameEvent(event)) {
		return event.to;
	}
	return undefined;
}

/**
 * Get the 'from' split path from a rename event.
 * Returns undefined for non-rename events.
 */
export function getEventFromSplitPath(
	event: VaultEvent,
): AnySplitPath | undefined {
	if (isRenameEvent(event)) {
		return event.from;
	}
	return undefined;
}

/**
 * Build path array from split path parts.
 */
function buildPathFromSplitPath(sp: AnySplitPath): string[] {
	switch (sp.kind) {
		case SplitPathKind.Folder:
			return [...sp.pathParts, sp.basename];
		case SplitPathKind.File:
			return [...sp.pathParts, `${sp.basename}.${sp.extension}`];
		case SplitPathKind.MdFile:
			return [...sp.pathParts, `${sp.basename}.md`];
	}
}

/**
 * Get the primary path from an event as a string array.
 * For rename events, returns the 'from' path.
 */
export function getEventPath(event: VaultEvent): string[] {
	const sp = getEventSplitPath(event);
	return buildPathFromSplitPath(sp);
}

/**
 * Get the target path from a rename event as a string array.
 * Returns undefined for non-rename events.
 */
export function getEventToPath(event: VaultEvent): string[] | undefined {
	const sp = getEventToSplitPath(event);
	if (!sp) return undefined;
	return buildPathFromSplitPath(sp);
}

/**
 * Get the parent directory path parts from an event.
 */
export function getEventParentPathParts(event: VaultEvent): string[] {
	const splitPath = getEventSplitPath(event);
	return splitPath.pathParts;
}

/**
 * Get the path depth (number of segments) for an event.
 */
export function getEventPathDepth(event: VaultEvent): number {
	return getEventPath(event).length;
}

// ─── Event Identification ───

/**
 * Get a unique key for an event based on its path.
 * Used for deduplication and dependency tracking.
 */
export function getEventKey(event: VaultEvent): string {
	if (isRenameEvent(event)) {
		const from = getEventPath(event);
		const to = getEventToPath(event);
		return `${event.kind}:${from.join("/")}→${to?.join("/")}`;
	}
	const path = getEventPath(event);
	return `${event.kind}:${path.join("/")}`;
}

/**
 * Check if two events operate on the same path.
 */
export function eventsSharePath(a: VaultEvent, b: VaultEvent): boolean {
	const pathA = getEventPath(a);
	const pathB = getEventPath(b);
	if (pathA.length !== pathB.length) return false;
	return pathA.every((part, i) => part === pathB[i]);
}

// ─── Type Narrowing ───

/**
 * Type guard: narrow to file created event.
 */
export function asFileCreatedEvent(
	event: VaultEvent,
): FileCreatedVaultEvent | undefined {
	if (isFileCreatedEvent(event)) return event;
	return undefined;
}

/**
 * Type guard: narrow to file deleted event.
 */
export function asFileDeletedEvent(
	event: VaultEvent,
): FileDeletedVaultEvent | undefined {
	if (isFileDeletedEvent(event)) return event;
	return undefined;
}

/**
 * Type guard: narrow to file renamed event.
 */
export function asFileRenamedEvent(
	event: VaultEvent,
): FileRenamedVaultEvent | undefined {
	if (isFileRenamedEvent(event)) return event;
	return undefined;
}

/**
 * Type guard: narrow to folder created event.
 */
export function asFolderCreatedEvent(
	event: VaultEvent,
): FolderCreatedVaultEvent | undefined {
	if (isFolderCreatedEvent(event)) return event;
	return undefined;
}

/**
 * Type guard: narrow to folder deleted event.
 */
export function asFolderDeletedEvent(
	event: VaultEvent,
): FolderDeletedVaultEvent | undefined {
	if (isFolderDeletedEvent(event)) return event;
	return undefined;
}

/**
 * Type guard: narrow to folder renamed event.
 */
export function asFolderRenamedEvent(
	event: VaultEvent,
): FolderRenamedVaultEvent | undefined {
	if (isFolderRenamedEvent(event)) return event;
	return undefined;
}

// ─── SplitPath Type Helpers ───

/**
 * Check if split path is a folder.
 */
export function isFolderSplitPath(sp: AnySplitPath): sp is SplitPathToFolder {
	return sp.kind === SplitPathKind.Folder;
}

/**
 * Check if split path is a regular file (non-md).
 */
export function isFileSplitPath(sp: AnySplitPath): sp is SplitPathToFile {
	return sp.kind === SplitPathKind.File;
}

/**
 * Check if split path is a markdown file.
 */
export function isMdFileSplitPath(sp: AnySplitPath): sp is SplitPathToMdFile {
	return sp.kind === SplitPathKind.MdFile;
}

// ─── Visitor Pattern ───

/**
 * Handler functions for the event visitor pattern.
 * All 6 cases must be handled - TypeScript enforces exhaustiveness.
 */
export type VaultEventVisitor<T> = {
	FileCreated: (event: FileCreatedVaultEvent) => T;
	FileDeleted: (event: FileDeletedVaultEvent) => T;
	FileRenamed: (event: FileRenamedVaultEvent) => T;
	FolderCreated: (event: FolderCreatedVaultEvent) => T;
	FolderDeleted: (event: FolderDeletedVaultEvent) => T;
	FolderRenamed: (event: FolderRenamedVaultEvent) => T;
};

/**
 * Visit an event with type-safe exhaustive handling.
 * All 6 event kinds must be handled - missing cases cause compile errors.
 *
 * @example
 * const result = visitEvent(event, {
 *   FileCreated: (e) => handleFileCreated(e),
 *   FileDeleted: (e) => handleFileDeleted(e),
 *   FileRenamed: (e) => handleFileRenamed(e),
 *   FolderCreated: (e) => handleFolderCreated(e),
 *   FolderDeleted: (e) => handleFolderDeleted(e),
 *   FolderRenamed: (e) => handleFolderRenamed(e),
 * });
 */
export function visitEvent<T>(
	event: VaultEvent,
	visitor: VaultEventVisitor<T>,
): T {
	switch (event.kind) {
		case VaultEventKind.FileCreated:
			return visitor.FileCreated(event);
		case VaultEventKind.FileDeleted:
			return visitor.FileDeleted(event);
		case VaultEventKind.FileRenamed:
			return visitor.FileRenamed(event);
		case VaultEventKind.FolderCreated:
			return visitor.FolderCreated(event);
		case VaultEventKind.FolderDeleted:
			return visitor.FolderDeleted(event);
		case VaultEventKind.FolderRenamed:
			return visitor.FolderRenamed(event);
	}
}

/**
 * Handler functions for the split path visitor pattern.
 * All 3 cases must be handled.
 */
export type SplitPathVisitor<T> = {
	Folder: (sp: SplitPathToFolder) => T;
	File: (sp: SplitPathToFile) => T;
	MdFile: (sp: SplitPathToMdFile) => T;
};

/**
 * Visit a split path with type-safe exhaustive handling.
 */
export function visitSplitPath<T>(
	sp: AnySplitPath,
	visitor: SplitPathVisitor<T>,
): T {
	switch (sp.kind) {
		case SplitPathKind.Folder:
			return visitor.Folder(sp);
		case SplitPathKind.File:
			return visitor.File(sp);
		case SplitPathKind.MdFile:
			return visitor.MdFile(sp);
	}
}

// ─── Namespace Export ───

export const EventHelpers = {
	// Type narrowing
	asFileCreatedEvent,
	asFileDeletedEvent,
	asFileRenamedEvent,
	asFolderCreatedEvent,
	asFolderDeletedEvent,
	asFolderRenamedEvent,
	eventsSharePath,
	getEventFromSplitPath,

	// Identification
	getEventKey,
	getEventParentPathParts,
	getEventPath,
	getEventPathDepth,

	// Path extraction
	getEventSplitPath,
	getEventToPath,
	getEventToSplitPath,
	// Operation classification
	isCreateEvent,
	isDeleteEvent,

	// Individual type guards
	isFileCreatedEvent,
	isFileDeletedEvent,
	isFileEvent,
	isFileRenamedEvent,
	isFileSplitPath,
	isFolderCreatedEvent,
	isFolderDeletedEvent,

	// Target type classification
	isFolderEvent,
	isFolderRenamedEvent,

	// SplitPath helpers
	isFolderSplitPath,
	isMdFileSplitPath,
	isRenameEvent,

	// Visitor pattern
	visitEvent,
	visitSplitPath,
};
