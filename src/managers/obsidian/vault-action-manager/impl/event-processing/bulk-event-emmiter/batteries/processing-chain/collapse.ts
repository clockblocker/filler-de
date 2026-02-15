import {
	type VaultEvent,
	VaultEventKind,
} from "../../../../../types/vault-event";
import { dedupeByKey, makeKeyFor } from "../../../../common/collapse-helpers";
import type {
	FileRenamedVaultEvent,
	FolderRenamedVaultEvent,
	RenameVaultEvent,
} from "../../types/bulk/helpers";
import { makeKeyForEvent } from "./helpers/make-key-for-event";

export function collapseVaultEvents(events: VaultEvent[]): VaultEvent[] {
	// 1) Exact dedupe (keep last)
	const deduped = dedupeByKey(events, makeKeyForEvent);

	// 2) Collapse rename chains (file + folder separately)
	const { collapsedRenames, rest } = collapseRenameChains(deduped);

	return [...rest, ...collapsedRenames];
}

/**
 * Collapse rename chains within the batch.
 * Example: A→B and B→C becomes A→C.
 *
 * Does NOT do root reduction (folder cover). That’s a later stage.
 */
function collapseRenameChains(events: VaultEvent[]): {
	collapsedRenames: RenameVaultEvent[];
	rest: VaultEvent[];
} {
	const fileRenames: FileRenamedVaultEvent[] = [];
	const folderRenames: FolderRenamedVaultEvent[] = [];
	const rest: VaultEvent[] = [];

	for (const e of events) {
		if (e.kind === VaultEventKind.FileRenamed) fileRenames.push(e);
		else if (e.kind === VaultEventKind.FolderRenamed) folderRenames.push(e);
		else rest.push(e);
	}

	const collapsedFiles = collapseRenameList(fileRenames);
	const collapsedFolders = collapseRenameList(folderRenames);

	return {
		collapsedRenames: [...collapsedFiles, ...collapsedFolders],
		rest,
	};
}

function collapseRenameList<T extends RenameVaultEvent>(renames: T[]): T[] {
	if (renames.length === 0) return [];

	const type = renames[0]?.kind;

	// forward map: fromKey -> to (keep last)
	const forward = new Map<string, T["to"]>();
	// representative "from" SplitPath for each fromKey (keep last)
	const fromByKey = new Map<string, T["from"]>();
	// all toKeys (to detect chain roots)
	const toKeys = new Set<string>();

	for (const r of renames) {
		const fk = makeKeyFor(r.from);
		forward.set(fk, r.to);
		fromByKey.set(fk, r.from);
		toKeys.add(makeKeyFor(r.to));
	}

	const resolveFinalTo = (fromKey: string): T["to"] | null => {
		const seen = new Set<string>();
		let cur = fromKey;

		while (true) {
			const next = forward.get(cur);
			if (!next) return null;

			const nextKey = makeKeyFor(next);

			// cycle guard: stop collapsing for this chain
			if (seen.has(cur) || seen.has(nextKey)) {
				return forward.get(fromKey) ?? null;
			}
			seen.add(cur);

			// reached final hop
			if (!forward.has(nextKey)) return next;

			cur = nextKey;
		}
	};

	// Contract: emit only chain roots
	// root fromKey = appears as a fromKey, but NOT as any toKey.
	const out: T[] = [];

	for (const fromKey of forward.keys()) {
		if (toKeys.has(fromKey)) continue; // not a chain root

		const from = fromByKey.get(fromKey);
		if (!from) continue;

		const toFinal = resolveFinalTo(fromKey);
		if (!toFinal) continue;

		// Drop no-op renames A→A
		if (makeKeyFor(from) === makeKeyFor(toFinal)) continue;

		out.push({ from, kind: type, to: toFinal } as T);
	}

	return out;
}
