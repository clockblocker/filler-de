import { VaultEventKind } from "../../../../../../../../managers/obsidian/vault-action-manager";
import type { AnySplitPath } from "../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { TreeNodeKind } from "../../../../tree-node/types/atoms";
import {
	type LibraryScopedBulkVaultEvent,
	type LibraryScopedVaultEvent,
	Scope,
} from "../library-scope/types/scoped-event";
import {
	getLeafNodeKind,
	SPLIT_PATH_KIND_TO_TREE_NODE_KIND,
} from "./helpers/materialized-event-helpers";
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

/**
 * Creates a Create event for leaf nodes from a split path.
 * Returns null for folders (sections are implicit, not created via Create).
 */
function makeCreateEvent(
	sp: AnySplitPath,
): MaterializedNodeEvent | null {
	const nodeKind = getLeafNodeKind(sp);
	if (!nodeKind) return null; // folders don't create events
	return {
		kind: MaterializedEventKind.Create,
		nodeKind,
		splitPath: sp,
	} as MaterializedNodeEvent;
}

function materializeCreateFromScopedEvent(
	e: LibraryScopedVaultEvent,
): MaterializedNodeEvent | null {
	if (e.scope !== Scope.Inside && e.scope !== Scope.OutsideToInside)
		return null;

	// Outside→Inside rename counts as Create (import)
	if (
		e.scope === Scope.OutsideToInside &&
		e.kind === VaultEventKind.FileRenamed
	) {
		return makeCreateEvent(e.to); // inside side is `to`
	}

	// Only FileCreated creates events (FolderCreated doesn't)
	if (e.kind === VaultEventKind.FileCreated) {
		return makeCreateEvent(e.splitPath);
	}

	return null;
}

/**
 * Creates a Delete event for any node type from a split path.
 */
function makeDeleteEvent(sp: AnySplitPath): MaterializedNodeEvent {
	const nodeKind = SPLIT_PATH_KIND_TO_TREE_NODE_KIND[sp.kind];
	return {
		kind: MaterializedEventKind.Delete,
		nodeKind,
		splitPath: sp,
	} as MaterializedNodeEvent;
}

function materializeDeleteFromScopedRoot(
	ev: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.Inside) return null;

	if (
		ev.kind === VaultEventKind.FileDeleted ||
		ev.kind === VaultEventKind.FolderDeleted
	) {
		return makeDeleteEvent(ev.splitPath);
	}

	return null;
}

/**
 * Deletes emitted from bulk.events ONLY for InsideToOutside boundary crossings.
 * (We ignore OutsideToInside deletes; they are outside-world.)
 */
function materializeDeleteFromScopedEventInsideToOutside(
	ev: LibraryScopedVaultEvent,
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.InsideToOutside) return null;

	// For InsideToOutside renames, the inside side is `from`
	if (
		ev.kind === VaultEventKind.FileRenamed ||
		ev.kind === VaultEventKind.FolderRenamed
	) {
		return makeDeleteEvent(ev.from);
	}

	return null;
}

export function materializeRenameFromScopedRoot(
	ev: LibraryScopedBulkVaultEvent["roots"][number],
): MaterializedNodeEvent | null {
	if (ev.scope !== Scope.Inside) return null;

	if (ev.kind === VaultEventKind.FileRenamed) {
		// Defensive: ensure from and to have matching kinds
		if (ev.from.kind !== ev.to.kind) return null;
		// Only leaf nodes (File/MdFile) for file renames
		if (ev.from.kind === SplitPathKind.Folder) return null;

		const nodeKind = SPLIT_PATH_KIND_TO_TREE_NODE_KIND[ev.from.kind];
		return {
			from: ev.from,
			kind: MaterializedEventKind.Rename,
			nodeKind,
			to: ev.to,
		} as MaterializedNodeEvent;
	}

	if (ev.kind === VaultEventKind.FolderRenamed) {
		return {
			from: ev.from,
			kind: MaterializedEventKind.Rename,
			nodeKind: TreeNodeKind.Section,
			to: ev.to,
		} as MaterializedNodeEvent;
	}

	return null;
}
