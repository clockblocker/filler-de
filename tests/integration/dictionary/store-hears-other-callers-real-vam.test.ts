/**
 * The dictionary store over the real Vault Action Manager. It subscribes to
 * every origin but its own, so the dictionary reset's and the metadata
 * migration's writes under `Worter/` reach it as events, and neither has to
 * rescan it by hand; its own writes never come back to it.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import {
	createVaultActionManager,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VaultActionKind,
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
	withReadingNotes,
} from "../../../src/packages/composed/dictionary/tests/support/paths";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";

const GEHEN = lemmaPath(gehen);
const GEHEN_READING = readingPath(gehenReading);

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

async function setUp() {
	const vault = makeObsidianVault({ "Library/Story.md": "# Story" });
	const { dispose, manager } = createVaultActionManager(vault.app);
	await Effect.runPromise(manager.startListening());
	const store = await Effect.runPromise(
		makeDumdictVaultStore({ vault: manager }),
	);
	const baseRevision = await Effect.runPromise(store.revision);
	const seeded = await Effect.runPromise(
		store.commitChanges({
			baseRevision,
			changes: [
				createLemma(gehen),
				createReading(readingEntry(gehenReading, { notes: "first" })),
			],
		}),
	);
	if (seeded.status !== "committed") throw new Error("seed did not commit");
	const notes = async () =>
		(await Effect.runPromise(store.lemmaNote(gehen)))?.readings.map(
			(entry) => entry.notes,
		);
	return {
		manager,
		notes,
		stop: async () => {
			await Effect.runPromise(store.close);
			await Effect.runPromise(dispose);
		},
		store,
		vault,
	};
}

describe("the dictionary store over real VAM", () => {
	it("follows the reset's backup move and the notes it writes again, with no rescan", async () => {
		const { manager, stop, store, vault } = await setUp();
		try {
			const lemma = await Effect.runPromise(manager.readContent(md(GEHEN)));
			await Effect.runPromise(
				manager.dispatch(
					[
						{
							kind: VaultActionKind.RenameFolder,
							payload: {
								from: folder("Worter"),
								onCollision: "fail",
								to: folder("Worter backup"),
								updateLinks: false,
							},
						},
					],
					{ caller: "reset" },
				),
			);
			await Effect.runPromise(store.caughtUp);
			expect(await Effect.runPromise(store.lemmaNotes)).toEqual([]);

			await Effect.runPromise(
				manager.dispatch(
					[
						{
							kind: VaultActionKind.CreateMdFile,
							payload: { content: lemma, splitPath: md(GEHEN) },
						},
					],
					{ caller: "reset" },
				),
			);
			await Effect.runPromise(store.caughtUp);
			expect((await Effect.runPromise(store.lemmaNote(gehen)))?.path).toBe(
				GEHEN,
			);
			expect(vault.files()).toContain(`Worter backup/${GEHEN.slice("Worter/".length)}`);
		} finally {
			await stop();
		}
	});

	it("re-reads a note the metadata migration rewrote", async () => {
		const { manager, notes, stop, store } = await setUp();
		try {
			expect(await notes()).toEqual(["first"]);
			await Effect.runPromise(
				manager.dispatch(
					[
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: md(GEHEN_READING),
								transform: (content) =>
									withReadingNotes(content, "migrated"),
							},
						},
					],
					{ caller: "migration" },
				),
			);
			await Effect.runPromise(store.caughtUp);
			expect(await notes()).toEqual(["migrated"]);
		} finally {
			await stop();
		}
	});
});
