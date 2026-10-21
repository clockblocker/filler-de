import { expect } from "bun:test";
import {
	legacyLemmaNotePath,
	parse,
	parseLegacyNotePath,
	shadowNotePath,
} from "@textfresser/lemma-note-codec";
import { Effect } from "effect";
import type { DumdictVaultStore } from "../../src";
import type { FakeVault } from "./fake-vault";

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromise(effect);

/**
 * Checks the store's reads against the files alone, both ways: every Lemma
 * note the codec accepts is read back from its path with the same records
 * or reported as a duplicate, every note the store lists is such a file,
 * every pending relation has its Shadow note, and every Shadow note either
 * stands for a pending relation or holds the user's content.
 */
export async function expectIndexMatchesFiles(
	store: DumdictVaultStore,
	vault: FakeVault,
): Promise<void> {
	const diagnostics = await run(store.diagnostics);
	const blocked = new Set(diagnostics.healingBlocked.map(({ path }) => path));
	const shadowFiles = new Set<string>();
	const neededShadows = new Set<string>();
	const noteFiles: string[] = [];
	for (const path of vault.markdownPaths()) {
		const { data } = parse(vault.content(path) ?? "", { language: "de" });
		for (const record of data.ok
			? data.data.pendingRelations
			: data.partial.pendingRelations)
			neededShadows.add(shadowNotePath(record.pending.target).path);
		if (!data.ok) {
			const parsedPath = parseLegacyNotePath(path);
			if (parsedPath.ok && parsedPath.value.type === "shadow")
				shadowFiles.add(path);
			continue;
		}
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
	for (const path of neededShadows) expect(shadowFiles).toContain(path);
	for (const path of shadowFiles)
		if (!neededShadows.has(path))
			expect(diagnostics.userShadows).toContain(path);
}
