import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import type { VaultEvent } from "../../../../../../../obsidian-vault-action-manager";
import type {
	SplitPath,
	SplitPathToFolder,
} from "../../../../../../../obsidian-vault-action-manager/types/split-path";
import { type LibraryScopedVaultEvent, Scope } from "./types";

export const makeVaultScoped = (
	scopedEvent: LibraryScopedVaultEvent,
): VaultEvent => {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();
	const { event, scope } = scopedEvent;

	if (scope === Scope.OutsideToOutside) {
		return event;
	}

	if (event.type === "FileRenamed") {
		if (scope === Scope.InsideToOutside) {
			return {
				...event,
				from: makeAbsolute(event.from, libraryRoot),
			};
		}

		if (scope === Scope.InsideToInside) {
			return {
				...event,
				from: makeAbsolute(event.from, libraryRoot),
				to: makeAbsolute(event.to, libraryRoot),
			};
		}

		if (scope === Scope.OutsideToInside) {
			return {
				...event,
				to: makeAbsolute(event.to, libraryRoot),
			};
		}

		return event;
	}

	if (event.type === "FolderRenamed") {
		if (scope === Scope.InsideToOutside) {
			return {
				...event,
				from: makeAbsolute(event.from, libraryRoot),
			};
		}

		if (scope === Scope.InsideToInside) {
			return {
				...event,
				from: makeAbsolute(event.from, libraryRoot),
				to: makeAbsolute(event.to, libraryRoot),
			};
		}

		if (scope === Scope.OutsideToInside) {
			return {
				...event,
				to: makeAbsolute(event.to, libraryRoot),
			};
		}

		return event;
	}

	if (event.type === "FileCreated") {
		if (scope === Scope.InsideToInside) {
			return {
				...event,
				splitPath: makeAbsolute(event.splitPath, libraryRoot),
			};
		}

		return event;
	}

	if (event.type === "FolderCreated") {
		if (scope === Scope.InsideToInside) {
			return {
				...event,
				splitPath: makeAbsolute(event.splitPath, libraryRoot),
			};
		}

		return event;
	}

	if (event.type === "FileDeleted") {
		if (scope === Scope.InsideToInside) {
			return {
				...event,
				splitPath: makeAbsolute(event.splitPath, libraryRoot),
			};
		}

		return event;
	}

	if (event.type === "FolderDeleted") {
		if (scope === Scope.InsideToInside) {
			return {
				...event,
				splitPath: makeAbsolute(event.splitPath, libraryRoot),
			};
		}

		return event;
	}

	return event;
};

function makeAbsolute<T extends SplitPath>(
	splitPath: T,
	libraryRoot: SplitPathToFolder,
): T {
	const libraryPath = [...libraryRoot.pathParts, libraryRoot.basename];

	return {
		...splitPath,
		pathParts: [...libraryPath, ...splitPath.pathParts],
	} as T;
}
