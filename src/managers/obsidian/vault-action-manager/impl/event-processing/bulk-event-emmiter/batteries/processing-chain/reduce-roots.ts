import type {
	AnySplitPath,
	CommonSplitPath,
	PathParts,
	SplitPathToFolder,
} from "../../../../../types/split-path";
import {
	type VaultEvent,
	VaultEventType,
} from "../../../../../types/vault-event";
import {
	isPossibleRoot,
	isRename,
	type PossibleRootVaultEvent,
} from "../../types/bulk/helpers";

export function reduceRoots(events: VaultEvent[]): PossibleRootVaultEvent[] {
	const possibleRoots = events.filter(isPossibleRoot);

	// Folder renames can cover descendant renames.
	const folderRenames = possibleRoots.filter(
		(e) => e.type === VaultEventType.FolderRenamed,
	);

	// Folder trashes can cover descendant deletes.
	const folderDeletes = possibleRoots.filter(
		(e) => e.type === VaultEventType.FolderDeleted,
	);

	const roots: PossibleRootVaultEvent[] = [];

	for (const e of possibleRoots) {
		if (isRename(e)) {
			if (e.type === VaultEventType.FolderRenamed) {
				// A folder rename is a root unless covered by another folder rename.
				const coveredByOtherFolderRename = folderRenames.some(
					(parent) =>
						parent !== e &&
						isCoveredByFolderRename(
							e.from,
							e.to,
							parent.from,
							parent.to,
						),
				);
				if (!coveredByOtherFolderRename) roots.push(e);
				continue;
			}

			// FileRenamed: root only if not covered by ANY folder rename.
			const covered = folderRenames.some((parent) =>
				isCoveredByFolderRename(e.from, e.to, parent.from, parent.to),
			);
			if (!covered) roots.push(e);
			continue;
		}

		if (e.type === VaultEventType.FolderDeleted) {
			// A folder trash is a root unless covered by another folder trash (nested).
			const coveredByOtherFolderDelete = folderDeletes.some((parent) => {
				if (parent === e) return false;
				return isUnderFolder(e.splitPath, parent.splitPath);
			});
			if (!coveredByOtherFolderDelete) roots.push(e);
			continue;
		}

		if (e.type === VaultEventType.FileDeleted) {
			// FileDeleteed: root only if not under ANY trashed folder.
			const coveredByFolderDelete = folderDeletes.some((parent) =>
				isPrefix(
					fullPathParts(parent.splitPath),
					fullPathParts(e.splitPath),
				),
			);
			if (!coveredByFolderDelete) roots.push(e);
		}
	}

	return roots;
}

function isUnderFolder(
	child: AnySplitPath,
	folder: SplitPathToFolder,
): boolean {
	const cf = fullPathParts(child);
	const pf = fullPathParts(folder);
	return isPrefix(pf, cf);
}

function isCoveredByFolderRename(
	childFrom: AnySplitPath,
	childTo: AnySplitPath,
	parentFrom: SplitPathToFolder,
	parentTo: SplitPathToFolder,
): boolean {
	const cf = fullPathParts(childFrom);
	const ct = fullPathParts(childTo);
	const pf = fullPathParts(parentFrom);
	const pt = fullPathParts(parentTo);

	if (!isPrefix(pf, cf)) return false;
	if (!isPrefix(pt, ct)) return false;

	const suffixFrom = cf.slice(pf.length);
	const suffixTo = ct.slice(pt.length);

	// same relative suffix => moved as part of folder rename
	if (!arrayEquals(suffixFrom, suffixTo)) return false;

	// Optional sanity: type compatibility (avoids weird matches)
	// e.g. file→folder rename shouldn't be "covered"
	if (childFrom.type !== childTo.type) return false;

	// Optional: extension compatibility for files
	if ("extension" in childFrom && "extension" in childTo) {
		if (childFrom.extension !== childTo.extension) return false;
	}

	return true;
}

function fullPathParts(sp: CommonSplitPath): string[] {
	return [...sp.pathParts, sp.basename];
}

function isPrefix(prefix: PathParts, full: PathParts): boolean {
	if (prefix.length > full.length) return false;
	for (let i = 0; i < prefix.length; i++) {
		if (prefix[i] !== full[i]) return false;
	}
	return true;
}

function arrayEquals(a: PathParts, b: PathParts): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
