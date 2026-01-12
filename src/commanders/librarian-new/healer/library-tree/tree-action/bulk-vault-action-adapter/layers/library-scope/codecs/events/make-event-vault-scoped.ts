import { VaultEventKind } from "../../../../../../../../../../managers/obsidian/vault-action-manager";
import type { CodecRules } from "../../../../../../codecs/rules";
import type { DescopedEvent } from "../../types/generics";
import type { LibraryScopedVaultEvent } from "../../types/scoped-event";
import { Scope } from "../../types/scoped-event";
import { makeVaultScopedSplitPath } from "../split-path-inside-the-library";

export function makeEventVaultScoped(
	event: LibraryScopedVaultEvent,
	rules: CodecRules,
): DescopedEvent<LibraryScopedVaultEvent> {
	const { scope, ...rest } = event;
	if (scope === Scope.Outside) return rest;

	switch (event.kind) {
		case VaultEventKind.FileCreated:
		case VaultEventKind.FileDeleted: {
			return {
				kind: event.kind,
				splitPath: makeVaultScopedSplitPath(event.splitPath, rules),
			};
		}

		case VaultEventKind.FolderCreated:
		case VaultEventKind.FolderDeleted: {
			return {
				kind: event.kind,
				splitPath: makeVaultScopedSplitPath(event.splitPath, rules),
			};
		}

		case VaultEventKind.FileRenamed: {
			switch (event.scope) {
				case Scope.Inside:
					return {
						from: makeVaultScopedSplitPath(event.from, rules),
						kind: VaultEventKind.FileRenamed,
						to: makeVaultScopedSplitPath(event.to, rules),
					};

				case Scope.InsideToOutside:
					return {
						from: makeVaultScopedSplitPath(event.from, rules),
						kind: VaultEventKind.FileRenamed,
						to: event.to,
					};

				case Scope.OutsideToInside:
					return {
						from: event.from,
						kind: VaultEventKind.FileRenamed,
						to: makeVaultScopedSplitPath(event.to, rules),
					};

				default: {
					const _never: never = event;
					return _never;
				}
			}
		}

		case VaultEventKind.FolderRenamed: {
			switch (event.scope) {
				case Scope.Inside:
					return {
						from: makeVaultScopedSplitPath(event.from, rules),
						kind: VaultEventKind.FolderRenamed,
						to: makeVaultScopedSplitPath(event.to, rules),
					};

				case Scope.InsideToOutside:
					return {
						from: makeVaultScopedSplitPath(event.from, rules),
						kind: VaultEventKind.FolderRenamed,
						to: event.to,
					};

				case Scope.OutsideToInside:
					return {
						from: event.from,
						kind: VaultEventKind.FolderRenamed,
						to: makeVaultScopedSplitPath(event.to, rules),
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
