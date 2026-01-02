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
	if (e.scope !== Scope.InsideToInside && e.scope !== Scope.OutsideToInside) {
		return null;
	}

	switch (e.event.type) {
		case VaultEventType.FileCreated: {
			const ev = e.event;
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
	r: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (r.scope !== Scope.InsideToInside) return null;

	switch (r.event.type) {
		case VaultEventType.FileDeleted: {
			const ev = r.event;
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
				libraryScopedSplitPath: r.event.splitPath,
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
	e: LibraryScopedVaultEvent,
): MaterializedNodeEvent | null {
	if (e.scope !== Scope.InsideToOutside) return null;

	switch (e.event.type) {
		case VaultEventType.FileRenamed: {
			const ev = e.event; // inside side is `from`
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
				libraryScopedSplitPath: e.event.from,
				nodeType: TreeNodeType.Section,
			};

		case VaultEventType.FileDeleted: {
			const ev = e.event;
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
				libraryScopedSplitPath: e.event.splitPath,
				nodeType: TreeNodeType.Section,
			};

		default:
			return null;
	}
}

export function materializeRenameFromScopedRoot(
	r: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (r.scope !== Scope.InsideToInside) return null;

	switch (r.event.type) {
		case VaultEventType.FileRenamed: {
			const ev = r.event;

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
				libraryScopedFrom: r.event.from,
				libraryScopedTo: r.event.to,
				nodeType: TreeNodeType.Section,
			};

		default:
			return null;
	}
}
