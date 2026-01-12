import { VaultEventKind } from "../../../../../../../../managers/obsidian/vault-action-manager";
import { TreeNodeKind } from "../../../../tree-node/types/atoms";
import {
	type LibraryScopedBulkVaultEvent,
	type LibraryScopedVaultEvent,
	Scope,
} from "../library-scope/types/scoped-event";
import { MaterializedEventKind, type MaterializedNodeEvent } from "./types";

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
	if (e.scope !== Scope.Inside && e.scope !== Scope.OutsideToInside)
		return null;

	// --- Outside→Inside rename counts as Create (import)
	if (
		e.scope === Scope.OutsideToInside &&
		e.kind === VaultEventKind.FileRenamed
	) {
		const sp = e.to; // inside side is `to`
		switch (sp.kind) {
			case "File":
				return {
					kind: MaterializedEventKind.Create,
					nodeKind: TreeNodeKind.File,
					splitPath: sp,
				};
			case "MdFile":
				return {
					kind: MaterializedEventKind.Create,
					nodeKind: TreeNodeKind.Scroll,
					splitPath: sp,
				};
			default:
				return null;
		}
	}

	switch (e.kind) {
		case VaultEventKind.FileCreated: {
			const sp = e.splitPath;
			switch (sp.kind) {
				case "File":
					return {
						kind: MaterializedEventKind.Create,
						nodeKind: TreeNodeKind.File,
						splitPath: sp,
					};
				case "MdFile":
					return {
						kind: MaterializedEventKind.Create,
						nodeKind: TreeNodeKind.Scroll,
						splitPath: sp,
					};
				default:
					return null;
			}
		}

		case VaultEventKind.FolderCreated:
			return null;

		default:
			return null;
	}
}

function materializeDeleteFromScopedRoot(
	ev: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.Inside) return null;

	switch (ev.kind) {
		case VaultEventKind.FileDeleted: {
			switch (ev.splitPath.kind) {
				case "File":
					return {
						kind: MaterializedEventKind.Delete,
						nodeKind: TreeNodeKind.File,
						splitPath: ev.splitPath,
					};
				case "MdFile":
					return {
						kind: MaterializedEventKind.Delete,
						nodeKind: TreeNodeKind.Scroll,
						splitPath: ev.splitPath,
					};
				default: {
					const _never: never = ev.splitPath;
					return _never;
				}
			}
		}

		case VaultEventKind.FolderDeleted:
			return {
				kind: MaterializedEventKind.Delete,
				nodeKind: TreeNodeKind.Section,
				splitPath: ev.splitPath,
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

	switch (ev.kind) {
		case VaultEventKind.FileRenamed: {
			switch (ev.from.kind) {
				case "File":
					return {
						kind: MaterializedEventKind.Delete,
						nodeKind: TreeNodeKind.File,
						splitPath: ev.from,
					};
				case "MdFile":
					return {
						kind: MaterializedEventKind.Delete,
						nodeKind: TreeNodeKind.Scroll,
						splitPath: ev.from,
					};
				default: {
					const _never: never = ev.from;
					return _never;
				}
			}
		}

		case VaultEventKind.FolderRenamed:
			// inside side is `from`
			return {
				kind: MaterializedEventKind.Delete,
				nodeKind: TreeNodeKind.Section,
				splitPath: ev.from,
			};

		default:
			return null;
	}
}

export function materializeRenameFromScopedRoot(
	ev: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.Inside) return null;

	switch (ev.kind) {
		case VaultEventKind.FileRenamed: {
			switch (ev.from.kind) {
				case "File": {
					const to = ev.to;
					if (to.kind !== "File") return null; // defensive
					return {
						from: ev.from,
						kind: MaterializedEventKind.Rename,
						nodeKind: TreeNodeKind.File,
						to: to,
					};
				}

				case "MdFile": {
					const to = ev.to;
					if (to.kind !== "MdFile") return null; // defensive
					return {
						from: ev.from,
						kind: MaterializedEventKind.Rename,
						nodeKind: TreeNodeKind.Scroll,
						to: to,
					};
				}

				default: {
					return null;
				}
			}
		}

		case VaultEventKind.FolderRenamed:
			return {
				from: ev.from,
				kind: MaterializedEventKind.Rename,
				nodeKind: TreeNodeKind.Section,
				to: ev.to,
			};

		default:
			return null;
	}
}
