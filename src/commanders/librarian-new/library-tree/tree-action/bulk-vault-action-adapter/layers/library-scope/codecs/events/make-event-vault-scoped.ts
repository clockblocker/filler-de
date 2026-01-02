import { VaultEventType } from "../../../../../../../../../obsidian-vault-action-manager";
import type { DescopedEvent } from "../../types/generics";

import type { LibraryScopedVaultEvent } from "../../types/scoped-event";
import { Scope } from "../../types/scoped-event";
import { makeVaultScopedSplitPath } from "../split-path-inside-the-library";

export function makeEventVaultScoped(
	event: LibraryScopedVaultEvent,
): DescopedEvent<LibraryScopedVaultEvent> {
	const { scope, ...rest } = event;
	if (scope === Scope.Outside) return rest;

	switch (event.type) {
		case VaultEventType.FileCreated:
		case VaultEventType.FileDeleted: {
			return {
				splitPath: makeVaultScopedSplitPath(event.splitPath),
				type: event.type,
			};
		}

		case VaultEventType.FolderCreated:
		case VaultEventType.FolderDeleted: {
			return {
				splitPath: makeVaultScopedSplitPath(event.splitPath),
				type: event.type,
			};
		}

		case VaultEventType.FileRenamed: {
			switch (event.scope) {
				case Scope.Inside:
					return {
						from: makeVaultScopedSplitPath(event.from),
						to: makeVaultScopedSplitPath(event.to),
						type: VaultEventType.FileRenamed,
					};

				case Scope.InsideToOutside:
					return {
						from: makeVaultScopedSplitPath(event.from),
						to: event.to,
						type: VaultEventType.FileRenamed,
					};

				case Scope.OutsideToInside:
					return {
						from: event.from,
						to: makeVaultScopedSplitPath(event.to),
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
						from: makeVaultScopedSplitPath(event.from),
						to: makeVaultScopedSplitPath(event.to),
						type: VaultEventType.FolderRenamed,
					};

				case Scope.InsideToOutside:
					return {
						from: makeVaultScopedSplitPath(event.from),
						to: event.to,
						type: VaultEventType.FolderRenamed,
					};

				case Scope.OutsideToInside:
					return {
						from: event.from,
						to: makeVaultScopedSplitPath(event.to),
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
}
