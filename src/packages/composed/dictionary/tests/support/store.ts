import type { PlannedChangeOp } from "dumdict";
import { Effect } from "effect";
import {
	type DictionaryDiagnostics,
	type DictionaryNoteCache,
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "../../src";
import { FakeVault } from "./fake-vault";
import { run } from "./files";

export async function openStore(
	vault: FakeVault = new FakeVault(),
	cache?: DictionaryNoteCache,
) {
	const reports: DictionaryDiagnostics[] = [];
	const store = await run(
		makeDumdictVaultStore({
			onDiagnostics: (diagnostics) =>
				Effect.sync(() => {
					reports.push(diagnostics);
				}),
			vault,
			...(cache ? { cache } : {}),
		}),
	);
	return { reports, store, vault };
}

export async function commit(
	store: DumdictVaultStore,
	changes: PlannedChangeOp<"de">[],
) {
	const baseRevision = await run(store.revision);
	return run(store.commitChanges({ baseRevision, changes }));
}

export async function seed(
	store: DumdictVaultStore,
	changes: PlannedChangeOp<"de">[],
) {
	const result = await commit(store, changes);
	if (result.status !== "committed")
		throw new Error(`Seed did not commit: ${JSON.stringify(result)}`);
}
