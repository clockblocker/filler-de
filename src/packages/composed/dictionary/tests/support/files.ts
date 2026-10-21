import { expect } from "bun:test";
import { legacyLemmaNotePath } from "@textfresser/lemma-note-codec";
import { Effect } from "effect";
import type { DumdictVaultStore } from "../../src";
import { readBundle } from "../../src/bundle";
import type { FakeVault } from "./fake-vault";

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromise(effect);

/**
 * Checks the store's reads against the files alone, both ways: every Lemma
 * bundle that reads is read back from its path with the same records
 * or reported as a duplicate, and every note the store lists is such a
 * file. A pending relation is read from its source note alone.
 */
export async function expectIndexMatchesFiles(
	store: DumdictVaultStore,
	vault: FakeVault,
): Promise<void> {
	const diagnostics = await run(store.diagnostics);
	const blocked = new Set(diagnostics.healingBlocked.map(({ path }) => path));
	const noteFiles: string[] = [];
	for (const path of vault.markdownPaths()) {
		const { data } = readBundle(vault.content(path) ?? "");
		if (!data.ok) continue;
		noteFiles.push(path);
		const note = await run(store.lemmaNote(data.data.lemmaRecord.lemma));
		if (note?.path !== path) continue;
		if (!blocked.has(path))
			expect(path).toBe(
				legacyLemmaNotePath(data.data.lemmaRecord.lemma).path,
			);
		expect(note).toEqual({
			ownedSurfaces: data.data.ownedSurfaceEntries,
			path,
			pendingRelations: data.data.pendingRelations,
			readings: data.data.readingEntries,
		});
	}
	const listed = (await run(store.lemmaNotes)).map(({ path }) => path);
	const duplicates = diagnostics.quarantined
		.filter(({ reason }) => reason._tag === "DuplicateLemma")
		.map(({ path }) => path);
	expect([...listed, ...duplicates].sort()).toEqual(noteFiles.sort());
}
