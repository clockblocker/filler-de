/**
 * Scoped Event Helpers - Utility functions for working with LibraryScopedVaultEvents.
 *
 * This module provides helper functions that eliminate the need for switch
 * statements when working with library-scoped events. Events have both a kind
 * (FileCreated, FileRenamed, etc.) and a scope (Inside, Outside, InsideToOutside,
 * OutsideToInside).
 *
 * Benefits:
 * - Single place to update when scoped event types change
 * - Type-safe scope and kind checking
 * - Visitor pattern for exhaustive handling
 */

import { VaultEventKind } from "../../../../../../../../../managers/obsidian/vault-action-manager";
import type {
	LibraryScopedVaultEvent,
	ScopedFileCreatedVaultEventInside,
	ScopedFileCreatedVaultEventOutside,
	ScopedFileDeletedVaultEventInside,
	ScopedFileDeletedVaultEventOutside,
	ScopedFileRenamedVaultEventInside,
	ScopedFileRenamedVaultEventInsideToOutside,
	ScopedFileRenamedVaultEventOutside,
	ScopedFileRenamedVaultEventOutsideToInside,
	ScopedFolderCreatedVaultEventInside,
	ScopedFolderCreatedVaultEventOutside,
	ScopedFolderDeletedVaultEventInside,
	ScopedFolderDeletedVaultEventOutside,
	ScopedFolderRenamedVaultEventInside,
	ScopedFolderRenamedVaultEventInsideToOutside,
	ScopedFolderRenamedVaultEventOutside,
	ScopedFolderRenamedVaultEventOutsideToInside,
} from "../types/scoped-event";
import { Scope } from "../types/scoped-event";

// ─── Scope Classification ───

/**
 * Check if event is entirely inside the library.
 */
export function isInsideScope(event: LibraryScopedVaultEvent): boolean {
	return event.scope === Scope.Inside;
}

/**
 * Check if event is entirely outside the library.
 */
export function isOutsideScope(event: LibraryScopedVaultEvent): boolean {
	return event.scope === Scope.Outside;
}

/**
 * Check if event crosses from inside to outside the library.
 */
export function isInsideToOutsideScope(
	event: LibraryScopedVaultEvent,
): boolean {
	return event.scope === Scope.InsideToOutside;
}

/**
 * Check if event crosses from outside to inside the library.
 */
export function isOutsideToInsideScope(
	event: LibraryScopedVaultEvent,
): boolean {
	return event.scope === Scope.OutsideToInside;
}

/**
 * Check if event involves the library at all (not entirely outside).
 */
export function involvesLibrary(event: LibraryScopedVaultEvent): boolean {
	return event.scope !== Scope.Outside;
}

/**
 * Check if event crosses library boundary.
 */
export function isBoundaryCrossing(event: LibraryScopedVaultEvent): boolean {
	return (
		event.scope === Scope.InsideToOutside ||
		event.scope === Scope.OutsideToInside
	);
}

// ─── Operation Classification ───

/**
 * Check if event represents a creation.
 */
export function isScopedCreateEvent(
	event: LibraryScopedVaultEvent,
): event is
	| ScopedFileCreatedVaultEventInside
	| ScopedFileCreatedVaultEventOutside
	| ScopedFolderCreatedVaultEventInside
	| ScopedFolderCreatedVaultEventOutside {
	return (
		event.kind === VaultEventKind.FileCreated ||
		event.kind === VaultEventKind.FolderCreated
	);
}

/**
 * Check if event represents a deletion.
 */
export function isScopedDeleteEvent(
	event: LibraryScopedVaultEvent,
): event is
	| ScopedFileDeletedVaultEventInside
	| ScopedFileDeletedVaultEventOutside
	| ScopedFolderDeletedVaultEventInside
	| ScopedFolderDeletedVaultEventOutside {
	return (
		event.kind === VaultEventKind.FileDeleted ||
		event.kind === VaultEventKind.FolderDeleted
	);
}

/**
 * Check if event represents a rename/move.
 */
export function isScopedRenameEvent(
	event: LibraryScopedVaultEvent,
): event is
	| ScopedFileRenamedVaultEventInside
	| ScopedFileRenamedVaultEventOutside
	| ScopedFileRenamedVaultEventInsideToOutside
	| ScopedFileRenamedVaultEventOutsideToInside
	| ScopedFolderRenamedVaultEventInside
	| ScopedFolderRenamedVaultEventOutside
	| ScopedFolderRenamedVaultEventInsideToOutside
	| ScopedFolderRenamedVaultEventOutsideToInside {
	return (
		event.kind === VaultEventKind.FileRenamed ||
		event.kind === VaultEventKind.FolderRenamed
	);
}

// ─── Target Type Classification ───

/**
 * Check if event operates on a folder.
 */
export function isScopedFolderEvent(
	event: LibraryScopedVaultEvent,
): event is
	| ScopedFolderCreatedVaultEventInside
	| ScopedFolderCreatedVaultEventOutside
	| ScopedFolderDeletedVaultEventInside
	| ScopedFolderDeletedVaultEventOutside
	| ScopedFolderRenamedVaultEventInside
	| ScopedFolderRenamedVaultEventOutside
	| ScopedFolderRenamedVaultEventInsideToOutside
	| ScopedFolderRenamedVaultEventOutsideToInside {
	return (
		event.kind === VaultEventKind.FolderCreated ||
		event.kind === VaultEventKind.FolderDeleted ||
		event.kind === VaultEventKind.FolderRenamed
	);
}

/**
 * Check if event operates on a file (md or non-md).
 */
export function isScopedFileEvent(
	event: LibraryScopedVaultEvent,
): event is
	| ScopedFileCreatedVaultEventInside
	| ScopedFileCreatedVaultEventOutside
	| ScopedFileDeletedVaultEventInside
	| ScopedFileDeletedVaultEventOutside
	| ScopedFileRenamedVaultEventInside
	| ScopedFileRenamedVaultEventOutside
	| ScopedFileRenamedVaultEventInsideToOutside
	| ScopedFileRenamedVaultEventOutsideToInside {
	return (
		event.kind === VaultEventKind.FileCreated ||
		event.kind === VaultEventKind.FileDeleted ||
		event.kind === VaultEventKind.FileRenamed
	);
}

// ─── Specific Scope + Kind Combinations ───

// File events inside
export function isFileCreatedInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFileCreatedVaultEventInside {
	return (
		event.kind === VaultEventKind.FileCreated &&
		event.scope === Scope.Inside
	);
}

export function isFileDeletedInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFileDeletedVaultEventInside {
	return (
		event.kind === VaultEventKind.FileDeleted &&
		event.scope === Scope.Inside
	);
}

export function isFileRenamedInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFileRenamedVaultEventInside {
	return (
		event.kind === VaultEventKind.FileRenamed &&
		event.scope === Scope.Inside
	);
}

// Folder events inside
export function isFolderCreatedInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFolderCreatedVaultEventInside {
	return (
		event.kind === VaultEventKind.FolderCreated &&
		event.scope === Scope.Inside
	);
}

export function isFolderDeletedInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFolderDeletedVaultEventInside {
	return (
		event.kind === VaultEventKind.FolderDeleted &&
		event.scope === Scope.Inside
	);
}

export function isFolderRenamedInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFolderRenamedVaultEventInside {
	return (
		event.kind === VaultEventKind.FolderRenamed &&
		event.scope === Scope.Inside
	);
}

// Boundary crossing events
export function isFileRenamedInsideToOutside(
	event: LibraryScopedVaultEvent,
): event is ScopedFileRenamedVaultEventInsideToOutside {
	return (
		event.kind === VaultEventKind.FileRenamed &&
		event.scope === Scope.InsideToOutside
	);
}

export function isFileRenamedOutsideToInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFileRenamedVaultEventOutsideToInside {
	return (
		event.kind === VaultEventKind.FileRenamed &&
		event.scope === Scope.OutsideToInside
	);
}

export function isFolderRenamedInsideToOutside(
	event: LibraryScopedVaultEvent,
): event is ScopedFolderRenamedVaultEventInsideToOutside {
	return (
		event.kind === VaultEventKind.FolderRenamed &&
		event.scope === Scope.InsideToOutside
	);
}

export function isFolderRenamedOutsideToInside(
	event: LibraryScopedVaultEvent,
): event is ScopedFolderRenamedVaultEventOutsideToInside {
	return (
		event.kind === VaultEventKind.FolderRenamed &&
		event.scope === Scope.OutsideToInside
	);
}

// ─── Visitor Pattern ───

/**
 * Handler functions for the scoped event visitor pattern.
 * All combinations of kind + scope must be handled.
 */
export type ScopedEventVisitor<T> = {
	// File events
	FileCreatedInside: (event: ScopedFileCreatedVaultEventInside) => T;
	FileCreatedOutside: (event: ScopedFileCreatedVaultEventOutside) => T;
	FileDeletedInside: (event: ScopedFileDeletedVaultEventInside) => T;
	FileDeletedOutside: (event: ScopedFileDeletedVaultEventOutside) => T;
	FileRenamedInside: (event: ScopedFileRenamedVaultEventInside) => T;
	FileRenamedOutside: (event: ScopedFileRenamedVaultEventOutside) => T;
	FileRenamedInsideToOutside: (
		event: ScopedFileRenamedVaultEventInsideToOutside,
	) => T;
	FileRenamedOutsideToInside: (
		event: ScopedFileRenamedVaultEventOutsideToInside,
	) => T;
	// Folder events
	FolderCreatedInside: (event: ScopedFolderCreatedVaultEventInside) => T;
	FolderCreatedOutside: (event: ScopedFolderCreatedVaultEventOutside) => T;
	FolderDeletedInside: (event: ScopedFolderDeletedVaultEventInside) => T;
	FolderDeletedOutside: (event: ScopedFolderDeletedVaultEventOutside) => T;
	FolderRenamedInside: (event: ScopedFolderRenamedVaultEventInside) => T;
	FolderRenamedOutside: (event: ScopedFolderRenamedVaultEventOutside) => T;
	FolderRenamedInsideToOutside: (
		event: ScopedFolderRenamedVaultEventInsideToOutside,
	) => T;
	FolderRenamedOutsideToInside: (
		event: ScopedFolderRenamedVaultEventOutsideToInside,
	) => T;
};

/**
 * Visit a scoped event with type-safe exhaustive handling.
 * All kind + scope combinations must be handled.
 */
export function visitScopedEvent<T>(
	event: LibraryScopedVaultEvent,
	visitor: ScopedEventVisitor<T>,
): T {
	switch (event.kind) {
		case VaultEventKind.FileCreated:
			return event.scope === Scope.Inside
				? visitor.FileCreatedInside(event)
				: visitor.FileCreatedOutside(event);

		case VaultEventKind.FileDeleted:
			return event.scope === Scope.Inside
				? visitor.FileDeletedInside(event)
				: visitor.FileDeletedOutside(event);

		case VaultEventKind.FileRenamed:
			switch (event.scope) {
				case Scope.Inside:
					return visitor.FileRenamedInside(event);
				case Scope.Outside:
					return visitor.FileRenamedOutside(event);
				case Scope.InsideToOutside:
					return visitor.FileRenamedInsideToOutside(event);
				case Scope.OutsideToInside:
					return visitor.FileRenamedOutsideToInside(event);
			}
			break;

		case VaultEventKind.FolderCreated:
			return event.scope === Scope.Inside
				? visitor.FolderCreatedInside(event)
				: visitor.FolderCreatedOutside(event);

		case VaultEventKind.FolderDeleted:
			return event.scope === Scope.Inside
				? visitor.FolderDeletedInside(event)
				: visitor.FolderDeletedOutside(event);

		case VaultEventKind.FolderRenamed:
			switch (event.scope) {
				case Scope.Inside:
					return visitor.FolderRenamedInside(event);
				case Scope.Outside:
					return visitor.FolderRenamedOutside(event);
				case Scope.InsideToOutside:
					return visitor.FolderRenamedInsideToOutside(event);
				case Scope.OutsideToInside:
					return visitor.FolderRenamedOutsideToInside(event);
			}
	}
}

/**
 * Simplified visitor for when you only care about inside-library events.
 * Outside events are handled by a single fallback.
 */
export type InsideEventVisitor<T> = {
	FileCreated: (event: ScopedFileCreatedVaultEventInside) => T;
	FileDeleted: (event: ScopedFileDeletedVaultEventInside) => T;
	FileRenamed: (event: ScopedFileRenamedVaultEventInside) => T;
	FileRenamedInsideToOutside: (
		event: ScopedFileRenamedVaultEventInsideToOutside,
	) => T;
	FileRenamedOutsideToInside: (
		event: ScopedFileRenamedVaultEventOutsideToInside,
	) => T;
	FolderCreated: (event: ScopedFolderCreatedVaultEventInside) => T;
	FolderDeleted: (event: ScopedFolderDeletedVaultEventInside) => T;
	FolderRenamed: (event: ScopedFolderRenamedVaultEventInside) => T;
	FolderRenamedInsideToOutside: (
		event: ScopedFolderRenamedVaultEventInsideToOutside,
	) => T;
	FolderRenamedOutsideToInside: (
		event: ScopedFolderRenamedVaultEventOutsideToInside,
	) => T;
	Outside: (event: LibraryScopedVaultEvent) => T;
};

/**
 * Visit a scoped event, with a simpler interface for inside-library events.
 * All outside events go to a single fallback handler.
 */
export function visitInsideEvent<T>(
	event: LibraryScopedVaultEvent,
	visitor: InsideEventVisitor<T>,
): T {
	if (event.scope === Scope.Outside) {
		return visitor.Outside(event);
	}

	switch (event.kind) {
		case VaultEventKind.FileCreated:
			return visitor.FileCreated(event);

		case VaultEventKind.FileDeleted:
			return visitor.FileDeleted(event);

		case VaultEventKind.FileRenamed:
			switch (event.scope) {
				case Scope.Inside:
					return visitor.FileRenamed(event);
				case Scope.InsideToOutside:
					return visitor.FileRenamedInsideToOutside(event);
				case Scope.OutsideToInside:
					return visitor.FileRenamedOutsideToInside(event);
			}
			break;

		case VaultEventKind.FolderCreated:
			return visitor.FolderCreated(event);

		case VaultEventKind.FolderDeleted:
			return visitor.FolderDeleted(event);

		case VaultEventKind.FolderRenamed:
			switch (event.scope) {
				case Scope.Inside:
					return visitor.FolderRenamed(event);
				case Scope.InsideToOutside:
					return visitor.FolderRenamedInsideToOutside(event);
				case Scope.OutsideToInside:
					return visitor.FolderRenamedOutsideToInside(event);
			}
	}
}

// ─── Namespace Export ───

export const ScopedEventHelpers = {
	// Scope classification
	isInsideScope,
	isOutsideScope,
	isInsideToOutsideScope,
	isOutsideToInsideScope,
	involvesLibrary,
	isBoundaryCrossing,

	// Operation classification
	isScopedCreateEvent,
	isScopedDeleteEvent,
	isScopedRenameEvent,

	// Target type classification
	isScopedFolderEvent,
	isScopedFileEvent,

	// Specific combinations
	isFileCreatedInside,
	isFileDeletedInside,
	isFileRenamedInside,
	isFolderCreatedInside,
	isFolderDeletedInside,
	isFolderRenamedInside,
	isFileRenamedInsideToOutside,
	isFileRenamedOutsideToInside,
	isFolderRenamedInsideToOutside,
	isFolderRenamedOutsideToInside,

	// Visitor pattern
	visitScopedEvent,
	visitInsideEvent,
};
