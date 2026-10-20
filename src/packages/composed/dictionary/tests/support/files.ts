import { expect } from "bun:test";
import {
	lemmaNotePath,
	parse,
	parseNotePath,
	shadowNotePath,
} from "@textfresser/lemma-note-codec";
import { Effect } from "effect";
import type { DumdictVaultStore } from "../../src";
import type { FakeVault } from "./fake-vault";

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromise(effect);

/**
 * Checks the store's reads against the files alone: every Lemma note the
 * codec accepts is read back from its path with the same records, every
 * pending relation has its Shadow note, and every Shadow note stands for a
 * pending relation.
 */
export async function expectIndexMatchesFiles(
	store: DumdictVaultStore,
	vault: FakeVault,
): Promise<void> {
	const shadowPaths = new Set<string>();
	const neededShadows = new Set<string>();
	for (const path of vault.markdownPaths()) {
		const { data } = parse(vault.content(path) ?? "", { language: "de" });
		if (!data.ok) {
			const parsedPath = parseNotePath(path);
			if (parsedPath.ok && parsedPath.value.type === "shadow")
				shadowPaths.add(path);
			continue;
		}
		const lemma = data.data.lemmaRecord.lemma;
		expect(path).toBe(lemmaNotePath(lemma).path);
		const note = await run(store.lemmaNote(lemma));
		expect(note).toEqual({
			ownedSurfaces: data.data.ownedSurfaceEntries,
			path,
			pendingRelations: data.data.pendingRelations,
			readings: data.data.readingEntries,
		});
		for (const record of data.data.pendingRelations)
			neededShadows.add(shadowNotePath(record.pending.target).path);
	}
	expect([...shadowPaths].sort()).toEqual([...neededShadows].sort());
}
