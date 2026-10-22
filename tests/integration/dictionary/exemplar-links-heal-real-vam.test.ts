/**
 * The dictionary store heals a misplaced Lemma note through Obsidian's
 * link-preserving rename. When a protected exemplar links to that Lemma,
 * the move still happens, and VAM puts the exemplar back as it was after
 * Obsidian's link updater rewrote it.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import {
	createVaultActionManager,
	type ProtectedPathModification,
	splitPathCodec,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	createLemma,
	createReading,
	gehen,
	gehenReading,
	readingEntry,
} from "../../../src/packages/composed/dictionary/tests/support/fixtures";
import {
	lemmaPath,
	readingPath,
} from "../../../src/packages/composed/dictionary/tests/support/paths";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";

const GEHEN = lemmaPath(gehen);
const GEHEN_READING = readingPath(gehenReading);
const MISPLACED = "Worter/misplaced/gehen.md";
const EXEMPLAR = "Exemplar/Kohlekraftwerk/Kohlekraftwerk.md";
const EXEMPLAR_CONTENT = "Wer [[gehen]] kann, kommt zum Kraftwerk.";

/** The files a store writes for gehen and one of its Readings. */
async function gehenFiles() {
	const vault = makeObsidianVault({});
	const { dispose, manager } = createVaultActionManager(vault.app);
	await Effect.runPromise(manager.startListening());
	const store = await Effect.runPromise(
		makeDumdictVaultStore({ vault: manager }),
	);
	const committed = await Effect.runPromise(
		store.commitChanges({
			baseRevision: await Effect.runPromise(store.revision),
			changes: [
				createLemma(gehen),
				createReading(readingEntry(gehenReading, { notes: "first" })),
			],
		}),
	);
	if (committed.status !== "committed") throw new Error("seed did not commit");
	await Effect.runPromise(store.close);
	await Effect.runPromise(dispose);
	return {
		lemma: vault.content(GEHEN) ?? "",
		reading: vault.content(GEHEN_READING) ?? "",
	};
}

describe("dictionary healing over real VAM, with a protected exemplar linking to the Lemma", () => {
	it("moves the Lemma note to its own path and leaves the exemplar as it was", async () => {
		const { lemma, reading } = await gehenFiles();
		const vault = makeObsidianVault({
			[EXEMPLAR]: EXEMPLAR_CONTENT,
			[GEHEN_READING]: reading,
			[MISPLACED]: lemma,
		});
		vault.linkTo(EXEMPLAR, MISPLACED);
		const { dispose, manager, testing } = createVaultActionManager(
			vault.app,
			{ protectedPaths: ["Exemplar"] },
		);
		const reported: ProtectedPathModification[] = [];
		try {
			await Effect.runPromise(manager.startListening());
			await Effect.runPromise(
				manager.subscribeToProtectedPathModifications((event) =>
					Effect.sync(() => reported.push(...event.modifications)),
				),
			);
			const store = await Effect.runPromise(
				makeDumdictVaultStore({ vault: manager }),
			);
			await Effect.runPromise(testing.whenSettled());

			expect(vault.files()).toContain(GEHEN);
			expect(vault.files()).not.toContain(MISPLACED);
			expect((await Effect.runPromise(store.lemmaNote(gehen)))?.path).toBe(
				GEHEN,
			);
			expect(vault.content(EXEMPLAR)).toBe(EXEMPLAR_CONTENT);
			expect(
				reported.map(({ renamed, splitPath, writer }) => ({
					path: splitPathCodec.format(splitPath),
					renamed,
					writer,
				})),
			).toEqual([
				{
					path: EXEMPLAR,
					renamed: { from: MISPLACED, to: GEHEN },
					writer: "RestoredAfterLinkUpdate",
				},
			]);
			await Effect.runPromise(store.close);
		} finally {
			await Effect.runPromise(dispose);
		}
	}, 20_000);
});
