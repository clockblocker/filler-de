import {
	type VaultEvent,
	VaultEventType,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager";

import type { EnscopedEvent } from "../../types/generics";
import { Scope } from "../../types/scoped-event";
import { tryParseAsInsideLibrarySplitPath } from "../split-path-inside-the-library";

export function makeEventLibraryScoped(
	event: VaultEvent,
): EnscopedEvent<VaultEvent> {
	switch (event.type) {
		case VaultEventType.FolderCreated:
		case VaultEventType.FolderDeleted: {
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
			};
		}

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
			};
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
				...event,
				scope: Scope.Outside,
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
				...event,
				scope: Scope.Outside,
			};
		}
	}
}
