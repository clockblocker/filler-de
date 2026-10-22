import { Effect } from "effect";
import { type TAbstractFile, TFolder } from "obsidian";
import { VamTargetExistsError } from "../../../effect/errors";
import { VaultIo } from "../../../effect/ports";
import { pathfinder } from "../../../helpers/pathfinder";
import type { RenameRedirect } from "../../../impl/event-processing/self-event-tracker";
import type { AnySplitPath } from "../../../types/split-path";
import { SplitPathKind } from "../../../types/split-path";
import type { VaultPathIdentity } from "../../../vault-path";

/** The file or folder name a split path ends in: `note.md`, `Folder`. */
function entryName(splitPath: AnySplitPath): string {
	return splitPath.kind === SplitPathKind.Folder
		? splitPath.basename
		: `${splitPath.basename}.${splitPath.extension}`;
}

/** The children of the folder `target` sits in; none when it is not there. */
function siblingsOf(vault: VaultIo["Service"], target: AnySplitPath) {
	return vault
		.getAbstractFileByPath(
			pathfinder.pathToFolderFromPathParts(target.pathParts),
		)
		.pipe(
			Effect.map((folder): readonly TAbstractFile[] =>
				folder instanceof TFolder ? folder.children : [],
			),
		);
}

/**
 * The file or folder that holds `target`'s path on the vault's file system:
 * the exact path, or a sibling whose name `paths` holds to be the same, such
 * as `Foo.md` for `foo.md` where case is ignored. `except`, the entry being
 * moved, never counts, so a rename that changes only case is free.
 */
export const occupantOf = Effect.fnUntraced(function* (
	target: AnySplitPath,
	paths: VaultPathIdentity,
	except?: TAbstractFile,
) {
	const vault = yield* VaultIo;
	const exact = yield* vault.getAbstractFileByPath(
		pathfinder.systemPathFromSplitPath(target),
	);
	if (exact && exact !== except) return exact;
	if (!paths.caseInsensitive) return undefined;
	const name = entryName(target);
	const siblings = yield* siblingsOf(vault, target);
	return siblings.find(
		(sibling) => sibling !== except && paths.same(sibling.name, name),
	);
});

/**
 * The first free indexed variant of `target` in its folder: `1_<name>`,
 * `2_<name>`, …. A name is taken when any sibling, file or folder, holds it
 * as the vault's file system compares names (`paths`), so `1_Foo` and
 * `1_foo` collide where case is ignored.
 */
export const firstFreeIndexedPath = Effect.fnUntraced(function* <
	SP extends AnySplitPath,
>(target: SP, paths: VaultPathIdentity) {
	const vault = yield* VaultIo;
	const siblings = yield* siblingsOf(vault, target);
	const taken = new Set(siblings.map((sibling) => paths.key(sibling.name)));
	return pathfinder.findFirstAvailableIndexedPath(target, (candidate) =>
		taken.has(paths.key(entryName(candidate))),
	);
});

/**
 * Attributes a rename VAM runs to another destination than its action
 * names, such as a free indexed name, as Self Events (#175).
 */
export type SelfRenameRecorder = {
	readonly expectRenameDestinationEffect: (
		redirect: RenameRedirect,
	) => Effect.Effect<void>;
};

/** The target of `to` is taken: the error a create or a failing rename gives. */
export function targetExists(
	operation: string,
	to: AnySplitPath,
	occupant: TAbstractFile,
	what: string,
): VamTargetExistsError {
	const path = pathfinder.systemPathFromSplitPath(to);
	return new VamTargetExistsError({
		cause: new Error(
			occupant.path === path
				? `${what}: ${path} already exists`
				: `${what}: ${occupant.path} already exists, which is ${path} on this vault's file system`,
		),
		occupiedBy: occupant.path,
		operation,
		path,
	});
}
