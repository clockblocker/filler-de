import { VaultEventType } from "../../../../../../../obsidian-vault-action-manager";
import { TreeNodeType } from "../../../../tree-node/types/atoms";
import {
	type LibraryScopedBulkVaultEvent,
	type LibraryScopedVaultEvent,
	Scope,
} from "../library-scope/types/scoped-event";
import { MaterializedEventType, type MaterializedNodeEvent } from "./types";

/**
 * Bulk (scoped) -> flat list of single-node "Create/Delete/Rename" events.
 *
 * Converts a `LibraryScopedBulkVaultEvent` into `MaterializedNodeEvent[]`
 * by discarding outside-world noise and expanding boundary-crossing effects
 * into inside-world node events.
 *
 * What it emits:
 * - `Create`: leaf-only (File|Scroll), from `bulk.events` where scope is
 *   InsideToInside or OutsideToInside.
 * - `Delete`:
 *   - from `bulk.roots` for InsideToInside deletes (folder delete covers subtree).
 *   - from `bulk.events` for InsideToOutside boundary crossings (delete inside side = `from`).
 * - `Rename`: from `bulk.roots` only, InsideToInside only.
 *
 * Invariants of the output:
 * - Exactly 1 node per event (no subtree semantics).
 * - All paths are library-scoped (relative to Library root).
 * - No CreateSection events (sections are implicit; created later by tree.ensureChain).
 * - No Rename emitted for boundary crossings (Outside↔Inside becomes Create/Delete).
 * - No canonicalization / intent inference here; pure normalization.
 */
export function materializeScopedBulk(
	bulk: LibraryScopedBulkVaultEvent,
): MaterializedNodeEvent[] {
	const out: MaterializedNodeEvent[] = [];

	for (const e of bulk.events) {
		const m = materializeCreateFromScopedEvent(e);
		if (m) out.push(m);
	}

	for (const r of bulk.roots) {
		const m = materializeDeleteFromScopedRoot(r);
		if (m) out.push(m);
	}

	for (const e of bulk.events) {
		const m = materializeDeleteFromScopedEventInsideToOutside(e);
		if (m) out.push(m);
	}

	for (const r of bulk.roots) {
		const m = materializeRenameFromScopedRoot(r);
		if (m) out.push(m);
	}

	return out;
}

function materializeCreateFromScopedEvent(
	e: LibraryScopedVaultEvent,
): MaterializedNodeEvent | null {
	if (e.scope !== Scope.Inside && e.scope !== Scope.OutsideToInside) {
		return null;
	}

	switch (e.type) {
		case VaultEventType.FileCreated: {
			const ev = e;
			switch (ev.splitPath.type) {
				case "File":
					return {
						kind: MaterializedEventType.Create,
						libraryScopedSplitPath: ev.splitPath,
						nodeType: TreeNodeType.File,
					};
				case "MdFile":
					return {
						kind: MaterializedEventType.Create,
						libraryScopedSplitPath: ev.splitPath,
						nodeType: TreeNodeType.Scroll,
					};
				default:
					return null;
			}
		}

		case VaultEventType.FolderCreated:
			// sections are implicit
			return null;

		default:
			return null;
	}
}

function materializeDeleteFromScopedRoot(
	ev: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.Inside) return null;

	switch (ev.type) {
		case VaultEventType.FileDeleted: {
			switch (ev.splitPath.type) {
				case "File":
					return {
						kind: MaterializedEventType.Delete,
						libraryScopedSplitPath: ev.splitPath,
						nodeType: TreeNodeType.File,
					};
				case "MdFile":
					return {
						kind: MaterializedEventType.Delete,
						libraryScopedSplitPath: ev.splitPath,
						nodeType: TreeNodeType.Scroll,
					};
				default: {
					const _never: never = ev.splitPath;
					return _never;
				}
			}
		}

		case VaultEventType.FolderDeleted:
			return {
				kind: MaterializedEventType.Delete,
				libraryScopedSplitPath: ev.splitPath,
				nodeType: TreeNodeType.Section,
			};

		default:
			return null;
	}
}

/**
 * Deletes emitted from bulk.events ONLY for InsideToOutside boundary crossings.
 * (We ignore OutsideToInside deletes; they are outside-world.)
 */
function materializeDeleteFromScopedEventInsideToOutside(
	ev: LibraryScopedVaultEvent,
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.InsideToOutside) return null;

	switch (ev.type) {
		case VaultEventType.FileRenamed: {
			switch (ev.from.type) {
				case "File":
					return {
						kind: MaterializedEventType.Delete,
						libraryScopedSplitPath: ev.from,
						nodeType: TreeNodeType.File,
					};
				case "MdFile":
					return {
						kind: MaterializedEventType.Delete,
						libraryScopedSplitPath: ev.from,
						nodeType: TreeNodeType.Scroll,
					};
				default: {
					const _never: never = ev.from;
					return _never;
				}
			}
		}

		case VaultEventType.FolderRenamed:
			// inside side is `from`
			return {
				kind: MaterializedEventType.Delete,
				libraryScopedSplitPath: ev.from,
				nodeType: TreeNodeType.Section,
			};

		default:
			return null;
	}
}

export function materializeRenameFromScopedRoot(
	ev: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.Inside) return null;

	switch (ev.type) {
		case VaultEventType.FileRenamed: {
			switch (ev.from.type) {
				case "File": {
					const to = ev.to;
					if (to.type !== "File") return null; // defensive
					return {
						kind: MaterializedEventType.Rename,
						libraryScopedFrom: ev.from,
						libraryScopedTo: to,
						nodeType: TreeNodeType.File,
					};
				}

				case "MdFile": {
					const to = ev.to;
					if (to.type !== "MdFile") return null; // defensive
					return {
						kind: MaterializedEventType.Rename,
						libraryScopedFrom: ev.from,
						libraryScopedTo: to,
						nodeType: TreeNodeType.Scroll,
					};
				}

				default: {
					return null;
				}
			}
		}

		case VaultEventType.FolderRenamed:
			return {
				kind: MaterializedEventType.Rename,
				libraryScopedFrom: ev.from,
				libraryScopedTo: ev.to,
				nodeType: TreeNodeType.Section,
			};

		default:
			return null;
	}
}
