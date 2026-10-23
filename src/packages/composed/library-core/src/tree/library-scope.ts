import type {
	AnySplitPath,
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
	PossibleRootVaultEvent,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	VaultEvent,
} from "@textfresser/vault-action-manager";
import {
	type SplitPathKind,
	splitPathCodec,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { Result } from "effect";
import {
	type CodecRules,
	isUnderLibraryRoot,
	libraryRootPath,
} from "../codecs/rules";
import type {
	AnySplitPathInsideLibrary,
	SplitPathInsideLibraryOf,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../codecs/split-path-inside-library";

/**
 * The semantic input consumed by Library: a `BulkVaultEvent`'s events and
 * roots. Observation diagnostics and origins stay in VAM; the Librarian
 * subscribes to external events only.
 */
export type LibraryBulk = {
	readonly events: readonly VaultEvent[];
	readonly roots: readonly PossibleRootVaultEvent[];
};

export const Scope = {
	Inside: "Inside",
	InsideToOutside: "InsideToOutside",
	Outside: "Outside",
	OutsideToInside: "OutsideToInside",
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

export type ScopedFileCreatedVaultEventInside = {
	kind: typeof VaultEventKind.FileCreated;
	scope: typeof Scope.Inside;
	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFileDeletedVaultEventInside = {
	kind: typeof VaultEventKind.FileDeleted;
	scope: typeof Scope.Inside;
	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFolderCreatedVaultEventInside = {
	kind: typeof VaultEventKind.FolderCreated;
	scope: typeof Scope.Inside;
	splitPath: SplitPathToFolderInsideLibrary;
};

export type ScopedFolderDeletedVaultEventInside = {
	kind: typeof VaultEventKind.FolderDeleted;
	scope: typeof Scope.Inside;
	splitPath: SplitPathToFolderInsideLibrary;
};

export type ScopedFileRenamedVaultEventInside = {
	from: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
	kind: typeof VaultEventKind.FileRenamed;
	scope: typeof Scope.Inside;
	to: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFolderRenamedVaultEventInside = {
	from: SplitPathToFolderInsideLibrary;
	kind: typeof VaultEventKind.FolderRenamed;
	scope: typeof Scope.Inside;
	to: SplitPathToFolderInsideLibrary;
};

export type ScopedFileRenamedVaultEventInsideToOutside = {
	from: ScopedFileRenamedVaultEventInside["from"];
	kind: typeof VaultEventKind.FileRenamed;
	scope: typeof Scope.InsideToOutside;
	to: FileRenamedVaultEvent["to"];
};

export type ScopedFolderRenamedVaultEventInsideToOutside = {
	from: ScopedFolderRenamedVaultEventInside["from"];
	kind: typeof VaultEventKind.FolderRenamed;
	scope: typeof Scope.InsideToOutside;
	to: FolderRenamedVaultEvent["to"];
};

export type ScopedFileRenamedVaultEventOutsideToInside = {
	from: FileRenamedVaultEvent["from"];
	kind: typeof VaultEventKind.FileRenamed;
	scope: typeof Scope.OutsideToInside;
	to: ScopedFileRenamedVaultEventInside["to"];
};

export type ScopedFolderRenamedVaultEventOutsideToInside = {
	from: FolderRenamedVaultEvent["from"];
	kind: typeof VaultEventKind.FolderRenamed;
	scope: typeof Scope.OutsideToInside;
	to: ScopedFolderRenamedVaultEventInside["to"];
};

export type ScopedFileRenamedVaultEventOutside = FileRenamedVaultEvent & {
	scope: typeof Scope.Outside;
};

export type ScopedFolderRenamedVaultEventOutside = FolderRenamedVaultEvent & {
	scope: typeof Scope.Outside;
};

export type ScopedFileDeletedVaultEventOutside = FileDeletedVaultEvent & {
	scope: typeof Scope.Outside;
};

export type ScopedFolderDeletedVaultEventOutside = FolderDeletedVaultEvent & {
	scope: typeof Scope.Outside;
};

export type ScopedFileCreatedVaultEventOutside = FileCreatedVaultEvent & {
	scope: typeof Scope.Outside;
};

export type ScopedFolderCreatedVaultEventOutside = FolderCreatedVaultEvent & {
	scope: typeof Scope.Outside;
};

export type LibraryScopedVaultEvent =
	| ScopedFileCreatedVaultEventInside
	| ScopedFileCreatedVaultEventOutside
	| ScopedFileDeletedVaultEventInside
	| ScopedFileDeletedVaultEventOutside
	| ScopedFileRenamedVaultEventInside
	| ScopedFileRenamedVaultEventInsideToOutside
	| ScopedFileRenamedVaultEventOutside
	| ScopedFileRenamedVaultEventOutsideToInside
	| ScopedFolderCreatedVaultEventInside
	| ScopedFolderCreatedVaultEventOutside
	| ScopedFolderDeletedVaultEventInside
	| ScopedFolderDeletedVaultEventOutside
	| ScopedFolderRenamedVaultEventInside
	| ScopedFolderRenamedVaultEventInsideToOutside
	| ScopedFolderRenamedVaultEventOutside
	| ScopedFolderRenamedVaultEventOutsideToInside;

export type LibraryScopedBulk = {
	events: LibraryScopedVaultEvent[];
	roots: LibraryScopedRootVaultEvent[];
};

export type LibraryScopedRootVaultEvent = Extract<
	LibraryScopedVaultEvent,
	{
		kind:
			| typeof VaultEventKind.FileDeleted
			| typeof VaultEventKind.FileRenamed
			| typeof VaultEventKind.FolderDeleted
			| typeof VaultEventKind.FolderRenamed;
	}
>;

type SplitPathKindOf<SP extends AnySplitPath> = SP["kind"];
type VaultSplitPathOf<K> = K extends typeof SplitPathKind.Folder
	? SplitPathToFolder
	: K extends typeof SplitPathKind.MdFile
		? SplitPathToMdFile
		: SplitPathToFile;

export type LibraryScope = {
	toLibraryBulk: (bulk: LibraryBulk) => LibraryScopedBulk;
	toLibraryEvent: (event: VaultEvent) => LibraryScopedVaultEvent;
	toLibraryPath: <SP extends AnySplitPath>(
		splitPath: SP,
	) => Result.Result<SplitPathInsideLibraryOf<SplitPathKindOf<SP>>, string>;
	toVaultEvent: (event: LibraryScopedVaultEvent) => VaultEvent;
	toVaultPath: <SP extends AnySplitPathInsideLibrary>(
		splitPath: SP,
	) => VaultSplitPathOf<SplitPathKindOf<SP>>;
};

/**
 * Owns the Vault <-> Library path policy for all in-process Library planning.
 * The configured root is captured once so callers cannot accidentally mix rules.
 *
 * Membership is case-sensitive: the Library Tree names nodes as Obsidian
 * spells them, so `library/A.md` is outside a Library rooted at `Library`
 * even where the file system puts it in the same folder.
 */
export function makeLibraryScope(rules: CodecRules): LibraryScope {
	const libraryRoot = libraryRootPath(rules);

	const toLibraryPath: LibraryScope["toLibraryPath"] = (splitPath) => {
		if (!isUnderLibraryRoot(splitPathCodec.format(splitPath), libraryRoot))
			return Result.fail("OutsideLibrary");

		return Result.succeed({
			...splitPath,
			pathParts: splitPath.pathParts.slice(
				rules.libraryRootPathParts.length,
			),
		} as SplitPathInsideLibraryOf<SplitPathKindOf<typeof splitPath>>);
	};

	const toVaultPath: LibraryScope["toVaultPath"] = (splitPath) =>
		({
			...splitPath,
			pathParts: [...rules.libraryRootPathParts, ...splitPath.pathParts],
		}) as VaultSplitPathOf<SplitPathKindOf<typeof splitPath>>;

	const toLibraryEvent = (event: VaultEvent): LibraryScopedVaultEvent => {
		switch (event.kind) {
			case VaultEventKind.FileCreated:
			case VaultEventKind.FileDeleted:
			case VaultEventKind.FolderCreated:
			case VaultEventKind.FolderDeleted: {
				const splitPath = toLibraryPath(event.splitPath);
				return {
					...event,
					scope: Result.isSuccess(splitPath)
						? Scope.Inside
						: Scope.Outside,
					splitPath: Result.isSuccess(splitPath)
						? splitPath.success
						: event.splitPath,
				} as LibraryScopedVaultEvent;
			}
			case VaultEventKind.FileRenamed:
			case VaultEventKind.FolderRenamed: {
				const from = toLibraryPath(event.from);
				const to = toLibraryPath(event.to);
				if (Result.isSuccess(from) && Result.isSuccess(to)) {
					return {
						...event,
						from: from.success,
						scope: Scope.Inside,
						to: to.success,
					} as LibraryScopedVaultEvent;
				}
				if (Result.isSuccess(from)) {
					return {
						...event,
						from: from.success,
						scope: Scope.InsideToOutside,
					} as LibraryScopedVaultEvent;
				}
				if (Result.isSuccess(to)) {
					return {
						...event,
						scope: Scope.OutsideToInside,
						to: to.success,
					} as LibraryScopedVaultEvent;
				}
				return { ...event, scope: Scope.Outside };
			}
		}
	};

	const toVaultEvent = (event: LibraryScopedVaultEvent): VaultEvent => {
		const { scope, ...unscoped } = event;
		if (scope === Scope.Outside) return unscoped as VaultEvent;

		switch (event.kind) {
			case VaultEventKind.FileCreated:
			case VaultEventKind.FileDeleted:
			case VaultEventKind.FolderCreated:
			case VaultEventKind.FolderDeleted:
				return {
					...unscoped,
					splitPath: toVaultPath(event.splitPath),
				} as VaultEvent;
			case VaultEventKind.FileRenamed:
			case VaultEventKind.FolderRenamed:
				return {
					...unscoped,
					from:
						scope === Scope.OutsideToInside
							? event.from
							: toVaultPath(event.from),
					to:
						scope === Scope.InsideToOutside
							? event.to
							: toVaultPath(event.to),
				} as VaultEvent;
		}
	};

	return {
		toLibraryBulk: (bulk) => ({
			events: bulk.events.map(toLibraryEvent),
			roots: bulk.roots.map(
				(root) => toLibraryEvent(root) as LibraryScopedRootVaultEvent,
			),
		}),
		toLibraryEvent,
		toLibraryPath,
		toVaultEvent,
		toVaultPath,
	};
}

/** Compatibility helpers. New code should configure `makeLibraryScope` once. */
export function makeEventLibraryScoped(
	event: VaultEvent,
	rules: CodecRules,
): LibraryScopedVaultEvent {
	return makeLibraryScope(rules).toLibraryEvent(event);
}

export function makeEventVaultScoped(
	event: LibraryScopedVaultEvent,
	rules: CodecRules,
): VaultEvent {
	return makeLibraryScope(rules).toVaultEvent(event);
}

export function tryParseAsInsideLibrarySplitPath<SP extends AnySplitPath>(
	splitPath: SP,
	rules: CodecRules,
): Result.Result<SplitPathInsideLibraryOf<SplitPathKindOf<SP>>, string> {
	return makeLibraryScope(rules).toLibraryPath(splitPath);
}

export function makeVaultScopedSplitPath<SP extends AnySplitPathInsideLibrary>(
	splitPath: SP,
	rules: CodecRules,
): VaultSplitPathOf<SplitPathKindOf<SP>> {
	return makeLibraryScope(rules).toVaultPath(splitPath);
}
