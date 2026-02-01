import {
	type VaultEvent,
	VaultEventKind,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/vault-event";
import type { CodecRules } from "../../../../../../../../codecs/rules";
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
} from "../../types/scoped-event";
import { Scope } from "../../types/scoped-event";
import { tryParseAsInsideLibrarySplitPath } from "../split-path-inside-the-library";

function scopeFileCreated(
	event: FileCreatedVaultEvent,
	rules: CodecRules,
): ScopedFileCreatedVaultEventInside | ScopedFileCreatedVaultEventOutside {
	const result = tryParseAsInsideLibrarySplitPath(event.splitPath, rules);
	if (result.isErr()) {
		return {
			kind: VaultEventKind.FileCreated,
			scope: Scope.Outside,
			splitPath: event.splitPath,
		};
	}
	return {
		kind: VaultEventKind.FileCreated,
		scope: Scope.Inside,
		splitPath: result.value,
	};
}

function scopeFileDeleted(
	event: FileDeletedVaultEvent,
	rules: CodecRules,
): ScopedFileDeletedVaultEventInside | ScopedFileDeletedVaultEventOutside {
	const result = tryParseAsInsideLibrarySplitPath(event.splitPath, rules);
	if (result.isErr()) {
		return {
			kind: VaultEventKind.FileDeleted,
			scope: Scope.Outside,
			splitPath: event.splitPath,
		};
	}
	return {
		kind: VaultEventKind.FileDeleted,
		scope: Scope.Inside,
		splitPath: result.value,
	};
}

function scopeFolderCreated(
	event: FolderCreatedVaultEvent,
	rules: CodecRules,
): ScopedFolderCreatedVaultEventInside | ScopedFolderCreatedVaultEventOutside {
	const result = tryParseAsInsideLibrarySplitPath(event.splitPath, rules);
	if (result.isErr()) {
		return {
			kind: VaultEventKind.FolderCreated,
			scope: Scope.Outside,
			splitPath: event.splitPath,
		};
	}
	return {
		kind: VaultEventKind.FolderCreated,
		scope: Scope.Inside,
		splitPath: result.value,
	};
}

function scopeFolderDeleted(
	event: FolderDeletedVaultEvent,
	rules: CodecRules,
): ScopedFolderDeletedVaultEventInside | ScopedFolderDeletedVaultEventOutside {
	const result = tryParseAsInsideLibrarySplitPath(event.splitPath, rules);
	if (result.isErr()) {
		return {
			kind: VaultEventKind.FolderDeleted,
			scope: Scope.Outside,
			splitPath: event.splitPath,
		};
	}
	return {
		kind: VaultEventKind.FolderDeleted,
		scope: Scope.Inside,
		splitPath: result.value,
	};
}

function scopeFileRenamed(
	event: FileRenamedVaultEvent,
	rules: CodecRules,
):
	| ScopedFileRenamedVaultEventInside
	| ScopedFileRenamedVaultEventOutside
	| ScopedFileRenamedVaultEventInsideToOutside
	| ScopedFileRenamedVaultEventOutsideToInside {
	const fromResult = tryParseAsInsideLibrarySplitPath(event.from, rules);
	const toResult = tryParseAsInsideLibrarySplitPath(event.to, rules);

	const fromInside = fromResult.isOk();
	const toInside = toResult.isOk();

	if (fromInside && toInside) {
		return {
			from: fromResult.value,
			kind: VaultEventKind.FileRenamed,
			scope: Scope.Inside,
			to: toResult.value,
		};
	}

	if (fromInside && !toInside) {
		return {
			from: fromResult.value,
			kind: VaultEventKind.FileRenamed,
			scope: Scope.InsideToOutside,
			to: event.to,
		};
	}

	if (!fromInside && toInside) {
		return {
			from: event.from,
			kind: VaultEventKind.FileRenamed,
			scope: Scope.OutsideToInside,
			to: toResult.value,
		};
	}

	return {
		from: event.from,
		kind: VaultEventKind.FileRenamed,
		scope: Scope.Outside,
		to: event.to,
	};
}

function scopeFolderRenamed(
	event: FolderRenamedVaultEvent,
	rules: CodecRules,
):
	| ScopedFolderRenamedVaultEventInside
	| ScopedFolderRenamedVaultEventOutside
	| ScopedFolderRenamedVaultEventInsideToOutside
	| ScopedFolderRenamedVaultEventOutsideToInside {
	const fromResult = tryParseAsInsideLibrarySplitPath(event.from, rules);
	const toResult = tryParseAsInsideLibrarySplitPath(event.to, rules);

	const fromInside = fromResult.isOk();
	const toInside = toResult.isOk();

	if (fromInside && toInside) {
		return {
			from: fromResult.value,
			kind: VaultEventKind.FolderRenamed,
			scope: Scope.Inside,
			to: toResult.value,
		};
	}

	if (fromInside && !toInside) {
		return {
			from: fromResult.value,
			kind: VaultEventKind.FolderRenamed,
			scope: Scope.InsideToOutside,
			to: event.to,
		};
	}

	if (!fromInside && toInside) {
		return {
			from: event.from,
			kind: VaultEventKind.FolderRenamed,
			scope: Scope.OutsideToInside,
			to: toResult.value,
		};
	}

	return {
		from: event.from,
		kind: VaultEventKind.FolderRenamed,
		scope: Scope.Outside,
		to: event.to,
	};
}

export function makeEventLibraryScoped(
	event: VaultEvent,
	rules: CodecRules,
): LibraryScopedVaultEvent {
	switch (event.kind) {
		case VaultEventKind.FileCreated:
			return scopeFileCreated(event, rules);
		case VaultEventKind.FileDeleted:
			return scopeFileDeleted(event, rules);
		case VaultEventKind.FolderCreated:
			return scopeFolderCreated(event, rules);
		case VaultEventKind.FolderDeleted:
			return scopeFolderDeleted(event, rules);
		case VaultEventKind.FileRenamed:
			return scopeFileRenamed(event, rules);
		case VaultEventKind.FolderRenamed:
			return scopeFolderRenamed(event, rules);
	}
}
