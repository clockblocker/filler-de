import {
	type VaultEvent,
	VaultEventType,
} from "../../../../../../../../../obsidian-vault-action-manager";
import type { LibraryScopedVaultEvent } from "../../types/scoped-event";
import { Scope } from "../../types/scoped-event";
import { tryParseAsInsideLibrarySplitPath } from "../split-path-inside-the-library";

export const makeEventLibraryScoped = (
	event: VaultEvent,
): LibraryScopedVaultEvent => {
	switch (event.type) {
		case VaultEventType.FolderCreated:
		case VaultEventType.FolderDeleted:
		case VaultEventType.FileCreated:
		case VaultEventType.FileDeleted: {
			const splitPathResult = tryParseAsInsideLibrarySplitPath(
				event.splitPath,
			);
			if (splitPathResult.isErr()) {
				return {
					scope: Scope.Outside,
					...event,
				};
			}
			return {
				...event,
				scope: Scope.Inside,
				splitPath: splitPathResult.value,
			} as LibraryScopedVaultEvent;
		}

		case VaultEventType.FileRenamed: {
			const fromResult = tryParseAsInsideLibrarySplitPath(event.from);
			const toResult = tryParseAsInsideLibrarySplitPath(event.to);

			if (fromResult.isOk() && toResult.isOk()) {
				return {
					from: fromResult.value,
					scope: Scope.Inside,
					to: toResult.value,
					type: VaultEventType.FileRenamed,
				};
			}

			if (fromResult.isOk() && toResult.isErr()) {
				return {
					from: fromResult.value,
					scope: Scope.InsideToOutside,
					to: event.to,
					type: VaultEventType.FileRenamed,
				};
			}

			if (fromResult.isErr() && toResult.isOk()) {
				return {
					from: event.from,
					scope: Scope.OutsideToInside,
					to: toResult.value,
					type: VaultEventType.FileRenamed,
				};
			}

			return {
				from: event.from,
				scope: Scope.Outside,
				to: event.to,
				type: VaultEventType.FileRenamed,
			};
		}

		case VaultEventType.FolderRenamed: {
			const fromResult = tryParseAsInsideLibrarySplitPath(event.from);
			const toResult = tryParseAsInsideLibrarySplitPath(event.to);

			if (fromResult.isOk() && toResult.isOk()) {
				return {
					from: fromResult.value,
					scope: Scope.Inside,
					to: toResult.value,
					type: VaultEventType.FolderRenamed,
				};
			}

			if (fromResult.isOk() && toResult.isErr()) {
				return {
					from: fromResult.value,
					scope: Scope.InsideToOutside,
					to: event.to,
					type: VaultEventType.FolderRenamed,
				};
			}

			if (fromResult.isErr() && toResult.isOk()) {
				return {
					from: event.from,
					scope: Scope.OutsideToInside,
					to: toResult.value,
					type: VaultEventType.FolderRenamed,
				};
			}

			return {
				from: event.from,
				scope: Scope.Outside,
				to: event.to,
				type: VaultEventType.FolderRenamed,
			};
		}

		default: {
			const _never: never = event;
			return _never;
		}
	}
};
