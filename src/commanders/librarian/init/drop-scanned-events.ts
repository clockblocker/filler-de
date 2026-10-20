import type {
	AnySplitPath,
	BulkVaultEvent,
	FileRenamedVaultEvent,
	VaultEvent,
} from "@textfresser/vault-action-manager";
import {
	splitPathCodec,
	VaultEventKind,
} from "@textfresser/vault-action-manager";

/**
 * Bulks buffered while startup reconciliation runs can hold file events from
 * before the scan. The scan already holds their result, and startup
 * reconciliation has healed it, so replaying them would heal those files
 * again: a stale create of a file since renamed becomes a second Leaf.
 *
 * Replays the buffered events in order against the set of file paths the
 * scan saw, and drops the two kinds the scan already holds:
 * - a create of a path the scan holds,
 * - a rename from a path the scan does not hold to one it does.
 *
 * Every kept event updates the set, so a file created, deleted or renamed
 * during startup keeps its later events. Deletes and folder events pass
 * through: deleting a node the tree lacks is a no-op, and the scan lists no
 * folders to compare against.
 */
export function dropScannedEvents(
	bulks: readonly BulkVaultEvent[],
	scanned: readonly AnySplitPath[],
): BulkVaultEvent[] {
	const known = new Set(scanned.map((path) => splitPathCodec.format(path)));
	return bulks.map((bulk) => {
		const dropped = new Set<VaultEvent>();
		for (const event of bulk.events) {
			if (!replay(event, known)) dropped.add(event);
		}
		if (dropped.size === 0) return bulk;
		const droppedRenames = new Set(
			[...dropped].flatMap((event) =>
				event.kind === VaultEventKind.FileRenamed
					? [renameKey(event)]
					: [],
			),
		);
		return {
			...bulk,
			events: bulk.events.filter((event) => !dropped.has(event)),
			roots: bulk.roots.filter(
				(root) =>
					root.kind !== VaultEventKind.FileRenamed ||
					!droppedRenames.has(renameKey(root)),
			),
		};
	});
}

/** Applies one event to `known`; returns whether to keep it. */
function replay(event: VaultEvent, known: Set<string>): boolean {
	switch (event.kind) {
		case VaultEventKind.FileCreated: {
			const path = splitPathCodec.format(event.splitPath);
			if (known.has(path)) return false;
			known.add(path);
			return true;
		}
		case VaultEventKind.FileRenamed: {
			const from = splitPathCodec.format(event.from);
			const to = splitPathCodec.format(event.to);
			if (!known.has(from) && known.has(to)) return false;
			known.delete(from);
			known.add(to);
			return true;
		}
		case VaultEventKind.FileDeleted:
			known.delete(splitPathCodec.format(event.splitPath));
			return true;
		case VaultEventKind.FolderCreated:
		case VaultEventKind.FolderRenamed:
		case VaultEventKind.FolderDeleted:
			return true;
	}
}

function renameKey(event: FileRenamedVaultEvent): string {
	return `${splitPathCodec.format(event.from)}\u0000${splitPathCodec.format(event.to)}`;
}
