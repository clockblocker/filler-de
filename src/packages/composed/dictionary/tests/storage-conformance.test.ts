import { describeStorageConformance } from "dumdict/testing";
import { Effect } from "effect";
import { makeDumdictVaultStore } from "../src";
import { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";

async function makeStorage() {
	const vault = new FakeVault();
	const store = await run(makeDumdictVaultStore({ vault }));
	return { store, vault };
}

describeStorageConformance(
	"DumdictVaultStore over a fake VAM",
	async () => {
		const { store } = await makeStorage();
		return store;
	},
	{ readingAttestations: true, revisions: true },
);

/**
 * The same cases, checking after every commit that the store's reads match
 * what the written files hold, so the suite passes through the notes and not
 * only through the index.
 */
describeStorageConformance(
	"DumdictVaultStore read back from its notes",
	async () => {
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
		};
	},
	{ readingAttestations: true, revisions: true },
);
