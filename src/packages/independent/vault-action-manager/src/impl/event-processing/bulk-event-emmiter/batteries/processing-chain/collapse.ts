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

/**
 * Dedupes `events` and collapses rename chains. A collapsed rename is its
 * chain's last hop with the first hop's `from`, so labels such as the
 * origin come from the last hop.
 */
export function collapseVaultEvents<E extends VaultEvent>(events: E[]): E[] {
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
function collapseRenameChains<E extends VaultEvent>(
	events: E[],
): {
	collapsedRenames: E[];
	rest: E[];
} {
	const fileRenames: (E & FileRenamedVaultEvent)[] = [];
	const folderRenames: (E & FolderRenamedVaultEvent)[] = [];
	const rest: E[] = [];

	for (const e of events) {
		if (e.kind === VaultEventKind.FileRenamed)
			fileRenames.push(e as E & FileRenamedVaultEvent);
		else if (e.kind === VaultEventKind.FolderRenamed)
			folderRenames.push(e as E & FolderRenamedVaultEvent);
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

	// forward map: fromKey -> the rename from it (keep last)
	const forward = new Map<string, T>();
	// all toKeys (to detect chain roots)
	const toKeys = new Set<string>();

	for (const r of renames) {
		forward.set(makeKeyFor(r.from), r);
		toKeys.add(makeKeyFor(r.to));
	}

	/** The chain's last hop from `fromKey`. */
	const resolveFinalHop = (fromKey: string): T | null => {
		const seen = new Set<string>();
		let cur = fromKey;

		while (true) {
			const hop = forward.get(cur);
			if (!hop) return null;

			const nextKey = makeKeyFor(hop.to);

			// cycle guard: stop collapsing for this chain
			if (seen.has(cur) || seen.has(nextKey)) {
				return forward.get(fromKey) ?? null;
			}
			seen.add(cur);

			// reached final hop
			if (!forward.has(nextKey)) return hop;

			cur = nextKey;
		}
	};

	// Contract: emit only chain roots
	// root fromKey = appears as a fromKey, but NOT as any toKey.
	const out: T[] = [];

	for (const [fromKey, first] of forward) {
		if (toKeys.has(fromKey)) continue; // not a chain root

		const last = resolveFinalHop(fromKey);
		if (!last) continue;

		// Drop no-op renames A→A
		if (makeKeyFor(first.from) === makeKeyFor(last.to)) continue;

		out.push({ ...last, from: first.from });
	}

	return out;
}
