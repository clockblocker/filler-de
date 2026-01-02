import {
	type VaultEvent,
	VaultEventType,
} from "../../../../../../../../obsidian-vault-action-manager";
import type { SplitPathToFolderInsideLibrary } from "../types/inside-library-split-paths";
import type { LibraryScopedVaultEvent } from "../types/scoped-event";
import { Scope } from "../types/scoped-event";
import {
	makeVaultScopedSplitPath,
	makeVaultScopedSplitPathForFile,
} from "./split-path-inside-the-library";

export const makeEventVaultScoped = (
	event: LibraryScopedVaultEvent,
): VaultEvent => {
	switch (event.type) {
		case VaultEventType.FileCreated:
		case VaultEventType.FileDeleted: {
			return {
				splitPath: makeVaultScopedSplitPathForFile(event.splitPath),
				type: event.type,
			};
		}

		case VaultEventType.FolderCreated:
		case VaultEventType.FolderDeleted: {
			return {
				splitPath: makeVaultScopedSplitPath(
					event.splitPath as SplitPathToFolderInsideLibrary,
				),
				type: event.type,
			};
		}

		case VaultEventType.FileRenamed: {
			switch (event.scope) {
				case Scope.Inside:
					return {
						from: makeVaultScopedSplitPathForFile(event.from),
						to: makeVaultScopedSplitPathForFile(event.to),
						type: VaultEventType.FileRenamed,
					};

				case Scope.InsideToOutside:
					return {
						from: makeVaultScopedSplitPathForFile(event.from),
						to: event.to,
						type: VaultEventType.FileRenamed,
					};

				case Scope.OutsideToInside:
					return {
						from: event.from,
						to: makeVaultScopedSplitPathForFile(event.to),
						type: VaultEventType.FileRenamed,
					};

				case Scope.OutsideToOutside:
					return {
						from: event.from,
						to: event.to,
						type: VaultEventType.FileRenamed,
					};

				default: {
					const _never: never = event;
					return _never;
				}
			}
		}

		case VaultEventType.FolderRenamed: {
			switch (event.scope) {
				case Scope.Inside:
					return {
						from: makeVaultScopedSplitPath(
							event.from as SplitPathToFolderInsideLibrary,
						),
						to: makeVaultScopedSplitPath(
							event.to as SplitPathToFolderInsideLibrary,
						),
						type: VaultEventType.FolderRenamed,
					};

				case Scope.InsideToOutside:
					return {
						from: makeVaultScopedSplitPath(
							event.from as SplitPathToFolderInsideLibrary,
						),
						to: event.to,
						type: VaultEventType.FolderRenamed,
					};

				case Scope.OutsideToInside:
					return {
						from: event.from,
						to: makeVaultScopedSplitPath(
							event.to as SplitPathToFolderInsideLibrary,
						),
						type: VaultEventType.FolderRenamed,
					};

				case Scope.OutsideToOutside:
					return {
						from: event.from,
						to: event.to,
						type: VaultEventType.FolderRenamed,
					};

				default: {
					const _never: never = event;
					return _never;
				}
			}
		}

		default: {
			const _never: never = event;
			return _never;
		}
	}
};
