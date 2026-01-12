import {
	type VaultEvent,
	VaultEventKind,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager";
import type { CodecRules } from "../../../../codecs/rules";
import type { EnscopedEvent } from "../../types/generics";
import { Scope } from "../../types/scoped-event";
import { tryParseAsInsideLibrarySplitPath } from "../split-path-inside-the-library";

export function makeEventLibraryScoped(
	event: VaultEvent,
	rules: CodecRules,
): EnscopedEvent<VaultEvent> {
	switch (event.kind) {
		case VaultEventKind.FolderCreated:
		case VaultEventKind.FolderDeleted: {
			const splitPathResult = tryParseAsInsideLibrarySplitPath(
				event.splitPath,
				rules,
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

		case VaultEventKind.FileCreated:
		case VaultEventKind.FileDeleted: {
			const splitPathResult = tryParseAsInsideLibrarySplitPath(
				event.splitPath,
				rules,
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

		case VaultEventKind.FileRenamed: {
			const fromResult = tryParseAsInsideLibrarySplitPath(event.from, rules);
			const toResult = tryParseAsInsideLibrarySplitPath(event.to, rules);

			if (fromResult.isOk() && toResult.isOk()) {
				return {
					from: fromResult.value,
					kind: VaultEventKind.FileRenamed,
					scope: Scope.Inside,
					to: toResult.value,
				};
			}

			if (fromResult.isOk() && toResult.isErr()) {
				return {
					from: fromResult.value,
					kind: VaultEventKind.FileRenamed,
					scope: Scope.InsideToOutside,
					to: event.to,
				};
			}

			if (fromResult.isErr() && toResult.isOk()) {
				return {
					from: event.from,
					kind: VaultEventKind.FileRenamed,
					scope: Scope.OutsideToInside,
					to: toResult.value,
				};
			}

			return {
				...event,
				scope: Scope.Outside,
			};
		}

		case VaultEventKind.FolderRenamed: {
			const fromResult = tryParseAsInsideLibrarySplitPath(event.from, rules);
			const toResult = tryParseAsInsideLibrarySplitPath(event.to, rules);

			if (fromResult.isOk() && toResult.isOk()) {
				return {
					from: fromResult.value,
					kind: VaultEventKind.FolderRenamed,
					scope: Scope.Inside,
					to: toResult.value,
				};
			}

			if (fromResult.isOk() && toResult.isErr()) {
				return {
					from: fromResult.value,
					kind: VaultEventKind.FolderRenamed,
					scope: Scope.InsideToOutside,
					to: event.to,
				};
			}

			if (fromResult.isErr() && toResult.isOk()) {
				return {
					from: event.from,
					kind: VaultEventKind.FolderRenamed,
					scope: Scope.OutsideToInside,
					to: toResult.value,
				};
			}

			return {
				...event,
				scope: Scope.Outside,
			};
		}
	}
}
