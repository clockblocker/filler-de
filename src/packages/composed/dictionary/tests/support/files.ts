import { expect } from "bun:test";
import { Effect } from "effect";
import type { DumdictVaultStore } from "../../src";
import {
	canonicalLemmaPath,
	canonicalReadingPath,
	NoteIndex,
} from "../../src/note-index";
import { classifyFile } from "../../src/notes";
import type { FakeVault } from "./fake-vault";

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromise(effect);

/** An index built from the vault's files alone, as a fresh startup builds it. */
function indexOfFiles(vault: FakeVault): NoteIndex {
	const index = new NoteIndex();
	for (const path of vault.markdownPaths())
		if (path.startsWith("Worter/"))
			index.set(path, classifyFile(path, vault.content(path) ?? ""));
	return index;
}

/**
 * Checks the store's reads against the files alone: every Lemma a fresh
 * index reads from the files is the store's, with the same records, at the
 * same Lemma and Reading note paths, each its own path unless healing is
 * blocked, and the store lists no other.
 */
export async function expectIndexMatchesFiles(
	store: DumdictVaultStore,
	vault: FakeVault,
): Promise<void> {
	const diagnostics = await run(store.diagnostics);
	const blocked = new Set(diagnostics.healingBlocked.map(({ path }) => path));
	const files = indexOfFiles(vault);
	const listed = await run(store.lemmaNotes);
	expect(listed).toEqual(
		files.lemmaNotes().map(({ data, path }) => ({
			lemma: data.lemmaRecord.lemma,
			path,
		})),
	);
	for (const { data, path } of files.lemmaNotes()) {
		const { lemma } = data.lemmaRecord;
		if (!blocked.has(path))
			expect(path).toBe(canonicalLemmaPath(lemma) ?? "");
		const { paradigm } = data.lemmaRecord;
		expect(await run(store.lemmaNote(lemma))).toEqual({
			ownedSurfaces: data.ownedSurfaceEntries,
			...(paradigm === undefined ? {} : { paradigm }),
			path,
			pendingRelations: data.pendingRelations,
			readings: data.readingEntries,
		});
		for (const { reading } of data.readingEntries) {
			const location = await run(store.readingLocation(reading));
			expect(location?.lemmaPath).toBe(path);
			if (location && !blocked.has(location.path))
				expect(location.path).toBe(canonicalReadingPath(reading) ?? "");
		}
	}
}
