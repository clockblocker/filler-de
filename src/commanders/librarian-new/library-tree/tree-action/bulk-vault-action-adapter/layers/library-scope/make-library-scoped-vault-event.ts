import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import type { VaultEvent } from "../../../../../../../obsidian-vault-action-manager";
import type { SplitPath } from "../../../../../../../obsidian-vault-action-manager/types/split-path";
import { type LibraryScopedVaultEvent, Scope } from "./types/scoped-event";

/**
 * Normalizes a raw VaultEvent into a **Library-scoped** event.
 *
 * What this does:
 * - Classifies the event as Inside↔Inside / Inside↔Outside / Outside↔Inside / Outside↔Outside
 *   relative to the configured Library root.
 * - **Strips the Library prefix** from all SplitPaths that are inside the Library.
 * - Guarantees that any SplitPath marked as “inside” is **relative to Library root**
 *   (`pathParts: []` = direct child of Library).
 *
 * Semantics:
 * - Outside→Outside events are passed through unchanged.
 * - Outside↔Inside boundary crossings are preserved but only the inside side
 *   (`from` or `to`) is library-scoped.
 * - No semantic interpretation is applied; this is pure scoping & normalization.
 *
 * This function establishes the invariant that **all downstream logic
 * operates on Library-relative SplitPaths only**.
 */
export const makeLibraryScopedVaultEvent = (
	event: VaultEvent,
): LibraryScopedVaultEvent => {
	switch (event.type) {
		case "FileRenamed": {
			const fromRel = tryMakeLibraryRelative(event.from);
			const toRel = tryMakeLibraryRelative(event.to);

			if (fromRel.isOk() && toRel.isOk())
				return {
					event: { ...event, from: fromRel.value, to: toRel.value },
					scope: Scope.InsideToInside,
				};

			if (fromRel.isOk() && toRel.isErr())
				return {
					event: { ...event, from: fromRel.value },
					scope: Scope.InsideToOutside,
				};

			if (fromRel.isErr() && toRel.isOk())
				return {
					event: { ...event, to: toRel.value },
					scope: Scope.OutsideToInside,
				};

			return { event, scope: Scope.OutsideToOutside };
		}

		case "FolderRenamed": {
			const fromRel = tryMakeLibraryRelative(event.from);
			const toRel = tryMakeLibraryRelative(event.to);

			if (fromRel.isOk() && toRel.isOk())
				return {
					event: { ...event, from: fromRel.value, to: toRel.value },
					scope: Scope.InsideToInside,
				};

			if (fromRel.isOk() && toRel.isErr())
				return {
					event: { ...event, from: fromRel.value },
					scope: Scope.InsideToOutside,
				};

			if (fromRel.isErr() && toRel.isOk())
				return {
					event: { ...event, to: toRel.value },
					scope: Scope.OutsideToInside,
				};

			return { event, scope: Scope.OutsideToOutside };
		}

		case "FileCreated": {
			const rel = tryMakeLibraryRelative(event.splitPath);
			return rel.isOk()
				? {
						event: { ...event, splitPath: rel.value },
						scope: Scope.InsideToInside,
					}
				: { event, scope: Scope.OutsideToOutside };
		}

		case "FolderCreated": {
			const rel = tryMakeLibraryRelative(event.splitPath);
			return rel.isOk()
				? {
						event: { ...event, splitPath: rel.value },
						scope: Scope.InsideToInside,
					}
				: { event, scope: Scope.OutsideToOutside };
		}

		case "FileDeleted": {
			const rel = tryMakeLibraryRelative(event.splitPath);
			return rel.isOk()
				? {
						event: { ...event, splitPath: rel.value },
						scope: Scope.InsideToInside,
					}
				: { event, scope: Scope.OutsideToOutside };
		}

		case "FolderDeleted": {
			const rel = tryMakeLibraryRelative(event.splitPath);
			return rel.isOk()
				? {
						event: { ...event, splitPath: rel.value },
						scope: Scope.InsideToInside,
					}
				: { event, scope: Scope.OutsideToOutside };
		}
	}
};

function libraryPrefix(): string[] {
	const { splitPathToLibraryRoot: libraryRoot } = getParsedUserSettings();
	return [...libraryRoot.pathParts, libraryRoot.basename];
}

function isPrefixedBy(path: string[], prefix: string[]) {
	if (path.length < prefix.length) return false;
	for (let i = 0; i < prefix.length; i++)
		if (path[i] !== prefix[i]) return false;
	return true;
}

function tryMakeLibraryRelative<T extends SplitPath>(
	sp: T,
): Result<T, "OutsideLibrary"> {
	const prefix = libraryPrefix();
	const full = sp.pathParts;
	if (!isPrefixedBy(full, prefix)) return err("OutsideLibrary");
	return ok({ ...sp, pathParts: full.slice(prefix.length) } as T);
}
