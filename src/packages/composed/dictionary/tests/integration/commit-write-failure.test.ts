import { describe, expect, test } from "bun:test";
import { legacyLemmaNotePath } from "@textfresser/lemma-note-codec";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import { type AddNewNoteRequest, createDumdictPlanner } from "dumdict/planning";
import { DictionaryWriteError } from "../../src";
import { expectIndexMatchesFiles, run } from "../support/files";
import {
	createLemma,
	createPending,
	createReading,
	gehen,
	gehenReading,
	laufen,
	laufenReading,
	pendingFrom,
	readingEntry,
	schreiten,
	schreitenReading,
} from "../support/fixtures";
import { openStore, seed } from "../support/store";

const planner = createDumdictPlanner("de");
const shadowPath = "Worter/de/Shadow/Lexeme/VERB/schreiten.md";
const gehenPath = legacyLemmaNotePath(gehen).path;
const laufenPath = legacyLemmaNotePath(laufen).path;
const schreitenPath = legacyLemmaNotePath(schreiten).path;

const schreitenNote: AddNewNoteRequest<"de"> = {
	draft: {
		note: { attestations: [], attestedTranslations: ["stride"], notes: "" },
		reading: schreitenReading,
	},
};

/** gehen and laufen, each with a synonym pending on a schreiten not yet stored. */
async function pendingDictionary() {
	const opened = await openStore();
	await seed(opened.store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
		createPending(pendingFrom(gehenReading)),
		createLemma(laufen),
		createReading(readingEntry(laufenReading)),
		createPending(pendingFrom(laufenReading)),
	]);
	expect(opened.vault.content(shadowPath)).toBeDefined();
	return opened;
}

async function planSchreiten(
	store: Awaited<ReturnType<typeof openStore>>["store"],
) {
	const context = await run(
		store.loadReadingEntryContext(
			planner.contextRequest({
				intent: "addNewNote",
				request: schreitenNote,
			}),
		),
	);
	if (context.intent !== "addNewNote") throw new Error("Expected addNewNote");
	const outcome = planner.addNewNote(context, schreitenNote);
	if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
	return outcome.plan;
}

const synonymsOf = async (
	store: Awaited<ReturnType<typeof openStore>>["store"],
	lemma: typeof gehen,
) =>
	(await run(store.lemmaNote(lemma)))?.readings[0]?.knowledge
		?.semanticRelations;

describe("a commit that touches several notes", () => {
	test("writes every note in one batch, then removes the resolved Shadow", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		expect(await run(store.commitChanges(plan))).toMatchObject({
			status: "committed",
		});

		const kinds = (batch: readonly { kind: string }[] = []) =>
			batch.map(({ kind }) => kind);
		// The commit creates schreiten, then rewrites gehen and laufen and
		// checks that the Shadow still holds the store's own body, then trashes it.
		expect(kinds(vault.batches.at(-3))).toEqual([
			VaultActionKind.CreateFile,
		]);
		expect(kinds(vault.batches.at(-2))).toEqual([
			VaultActionKind.ProcessMdFile,
			VaultActionKind.ProcessMdFile,
			VaultActionKind.ProcessMdFile,
		]);
		expect(kinds(vault.batches.at(-1))).toEqual([
			VaultActionKind.TrashMdFile,
		]);
		expect(await synonymsOf(store, gehen)).toEqual({
			synonym: [schreiten],
		});
		expect(await synonymsOf(store, laufen)).toEqual({
			synonym: [schreiten],
		});
		expect(vault.content(shadowPath)).toBeUndefined();
		await expectIndexMatchesFiles(store, vault);
	});

	test("a write that fails part-way leaves the index rebuilt to match the files", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		const before = await run(store.revision);
		vault.failNextWrite((_action, path) => path === laufenPath);

		const failure = await run(store.commitChanges(plan)).catch(
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(DictionaryWriteError);
		expect(failure).toMatchObject({
			executed: [schreitenPath, gehenPath],
			rebuilt: true,
			skipped: [shadowPath],
		});

		// The writes before the failure stayed; the index says so.
		expect((await run(store.lemmaNote(schreiten)))?.path).toBe(
			schreitenPath,
		);
		expect(await synonymsOf(store, gehen)).toEqual({
			synonym: [schreiten],
		});
		expect(await synonymsOf(store, laufen)).toBeUndefined();
		expect((await run(store.lemmaNote(laufen)))?.pendingRelations).toEqual([
			pendingFrom(laufenReading),
		]);
		expect(vault.content(shadowPath)).toBeDefined();
		await expectIndexMatchesFiles(store, vault);

		// A store built from the same files reads the same dictionary.
		const fresh = await openStore(vault);
		for (const lemma of [gehen, laufen, schreiten])
			expect(await run(fresh.store.lemmaNote(lemma))).toEqual(
				await run(store.lemmaNote(lemma)),
			);

		// The old plan is stale, and re-planning finishes the job.
		expect(await run(store.revision)).not.toBe(before);
		expect(await run(store.commitChanges(plan))).toMatchObject({
			code: "revisionConflict",
			status: "conflict",
		});
		const resolutions = [{ locator: pendingFrom(laufenReading).locator }];
		const slice = await run(
			store.loadCleanupRelationsContext({ resolutions }),
		);
		const cleanup = planner.cleanupRelations(slice, {
			baseRevision: slice.revision,
			resolutions,
		});
		if (cleanup.status !== "planned")
			throw new Error(JSON.stringify(cleanup));
		expect(await run(store.commitChanges(cleanup.plan))).toMatchObject({
			status: "committed",
		});
		expect(await synonymsOf(store, laufen)).toEqual({
			synonym: [schreiten],
		});
		expect(vault.content(shadowPath)).toBeUndefined();
		await expectIndexMatchesFiles(store, vault);
	});

	test("a note edited between the commit's read and its write is left alone", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		const edited = `${vault.content(laufenPath)}\nA line typed while the commit ran.\n`;
		// The edit lands just before laufen's write runs; its compare-and-swap refuses.
		vault.failNextWrite((_action, path) => {
			if (path === laufenPath) vault.silentWrite(laufenPath, edited);
			return false;
		});

		const failure = await run(store.commitChanges(plan)).catch(
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(DictionaryWriteError);
		expect(vault.content(laufenPath)).toBe(edited);
		await expectIndexMatchesFiles(store, vault);
	});
});
