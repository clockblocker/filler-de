import type { ConformanceStorage } from "dumdict/testing";
import { describeStorageConformance } from "dumdict/testing";
import type * as Dumling from "dumling/types";
import { Effect } from "effect";
import { type DumdictVaultStore, makeDumdictVaultStore } from "../src";
import { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";

async function makeStorage() {
	const vault = new FakeVault();
	const store = await run(makeDumdictVaultStore({ vault }));
	return { store, vault };
}

/**
 * Removes a Lemma as the user does outside dumdict's plans: by deleting its
 * Lemma note and its Reading notes, which the store observes as vault
 * events.
 */
const removeLemmaNote =
	(store: DumdictVaultStore, vault: FakeVault) =>
	(lemma: Dumling.Lemma<"de">) =>
		Effect.gen(function* () {
			const note = yield* store.lemmaNote(lemma);
			if (!note) return;
			const readings = yield* Effect.forEach(
				note.readings,
				({ reading }) => store.readingLocation(reading),
			);
			yield* Effect.promise(() =>
				vault.userDeleteAll([
					note.path,
					...readings.flatMap((location) =>
						location ? [location.path] : [],
					),
				]),
			);
		});

describeStorageConformance(
	"DumdictVaultStore over a fake VAM",
	async (): Promise<ConformanceStorage> => {
		const { store, vault } = await makeStorage();
		return { ...store, removeLemma: removeLemmaNote(store, vault) };
	},
	{},
);

/**
 * The same cases, checking after every commit that the store's reads match
 * what the written files hold, so the suite passes through the notes and not
 * only through the index.
 */
describeStorageConformance(
	"DumdictVaultStore read back from its notes",
	async (): Promise<ConformanceStorage> => {
		const { store, vault } = await makeStorage();
		return {
			...store,
			commitChanges: (request) =>
				store
					.commitChanges(request)
					.pipe(
						Effect.tap(() =>
							Effect.promise(() =>
								expectIndexMatchesFiles(store, vault),
							),
						),
					),
			removeLemma: removeLemmaNote(store, vault),
		};
	},
	{},
);
