import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import type { VaultEvent } from "../../../../../../../obsidian-vault-action-manager";
import type {
	SplitPath,
	SplitPathToFolder,
} from "../../../../../../../obsidian-vault-action-manager/types/split-path";
import { type LibraryScopedVaultEvent, Scope } from "./types";

export const makeLibraryScopedVaultEvent = (
	event: VaultEvent,
): LibraryScopedVaultEvent => {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();

	if (event.type === "FileRenamed") {
		const fromInside = isInsideLibrary(event.from, libraryRoot);
		const toInside = isInsideLibrary(event.to, libraryRoot);

		if (fromInside && !toInside) {
			return {
				event: {
					...event,
					from: makeRelative(event.from, libraryRoot),
				},
				scope: Scope.InsideToOutside,
			};
		}

		if (fromInside && toInside) {
			return {
				event: {
					...event,
					from: makeRelative(event.from, libraryRoot),
					to: makeRelative(event.to, libraryRoot),
				},
				scope: Scope.InsideToInside,
			};
		}

		if (!fromInside && toInside) {
			return {
				event: {
					...event,
					to: makeRelative(event.to, libraryRoot),
				},
				scope: Scope.OutsideToInside,
			};
		}

		return {
			event,
			scope: Scope.OutsideToOutside,
		};
	}

	if (event.type === "FolderRenamed") {
		const fromInside = isInsideLibrary(event.from, libraryRoot);
		const toInside = isInsideLibrary(event.to, libraryRoot);

		if (fromInside && !toInside) {
			return {
				event: {
					...event,
					from: makeRelative(event.from, libraryRoot),
				},
				scope: Scope.InsideToOutside,
			};
		}

		if (fromInside && toInside) {
			return {
				event: {
					...event,
					from: makeRelative(event.from, libraryRoot),
					to: makeRelative(event.to, libraryRoot),
				},
				scope: Scope.InsideToInside,
			};
		}

		if (!fromInside && toInside) {
			return {
				event: {
					...event,
					to: makeRelative(event.to, libraryRoot),
				},
				scope: Scope.OutsideToInside,
			};
		}

		return {
			event,
			scope: Scope.OutsideToOutside,
		};
	}

	if (event.type === "FileCreated") {
		const inside = isInsideLibrary(event.splitPath, libraryRoot);

		if (inside) {
			return {
				event: {
					...event,
					splitPath: makeRelative(event.splitPath, libraryRoot),
				},
				scope: Scope.InsideToInside,
			};
		}

		return {
			event,
			scope: Scope.OutsideToOutside,
		};
	}

	if (event.type === "FolderCreated") {
		const inside = isInsideLibrary(event.splitPath, libraryRoot);

		if (inside) {
			return {
				event: {
					...event,
					splitPath: makeRelative(event.splitPath, libraryRoot),
				},
				scope: Scope.InsideToInside,
			};
		}

		return {
			event,
			scope: Scope.OutsideToOutside,
		};
	}

	if (event.type === "FileDeleted") {
		const inside = isInsideLibrary(event.splitPath, libraryRoot);

		if (inside) {
			return {
				event: {
					...event,
					splitPath: makeRelative(event.splitPath, libraryRoot),
				},
				scope: Scope.InsideToInside,
			};
		}

		return {
			event,
			scope: Scope.OutsideToOutside,
		};
	}

	if (event.type === "FolderDeleted") {
		const inside = isInsideLibrary(event.splitPath, libraryRoot);

		if (inside) {
			return {
				event: {
					...event,
					splitPath: makeRelative(event.splitPath, libraryRoot),
				},
				scope: Scope.InsideToInside,
			};
		}

		return {
			event,
			scope: Scope.OutsideToOutside,
		};
	}

	// TypeScript exhaustive check - all cases handled above
	return {
		event,
		scope: Scope.OutsideToOutside,
	};
};

function isInsideLibrary(splitPath: SplitPath, libraryRoot: SplitPathToFolder) {
	const libraryPath = [...libraryRoot.pathParts, libraryRoot.basename];
	const pathFull = [...splitPath.pathParts];

	if (pathFull.length < libraryPath.length) return false;

	for (let i = 0; i < libraryPath.length; i++) {
		if (pathFull[i] !== libraryPath[i]) return false;
	}

	return true;
}

function makeRelative<T extends SplitPath>(
	splitPath: T,
	libraryRoot: SplitPathToFolder,
): T {
	const libraryPath = [...libraryRoot.pathParts, libraryRoot.basename];
	const pathFull = [...splitPath.pathParts];

	if (pathFull.length < libraryPath.length) return splitPath;

	for (let i = 0; i < libraryPath.length; i++) {
		if (pathFull[i] !== libraryPath[i]) return splitPath;
	}

	return {
		...splitPath,
		pathParts: pathFull.slice(libraryPath.length),
	} as T;
}
