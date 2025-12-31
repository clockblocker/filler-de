// declare function makeLocatorFromRenameFrom(
// 	ev:
// 		| RenameFileNodeMaterializedEvent
// 		| RenameScrollNodeMaterializedEvent
// 		| RenameSectionNodeMaterializedEvent,
// ): FileNodeLocator | ScrollNodeLocator | SectionNodeLocator;

import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../obsidian-vault-action-manager/types/split-path";

import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "../types/target-chains";

export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	splitPath: SplitPath,
): TreeNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	splitPath: SplitPathToFile,
): FileNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	splitPath: SplitPathToMdFile,
): ScrollNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	splitPath: SplitPathToFolder,
): SectionNodeLocator;
export function makeLocatorFromLibraryScopedCanonicalSplitPath(
	splitPath: SplitPath,
): TreeNodeLocator;
