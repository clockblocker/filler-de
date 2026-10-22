import { describe, expect, test } from "bun:test";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import { type AddNewNoteRequest, createDumdictPlanner } from "dumdict/planning";
import { DictionaryWriteError } from "../../src";
import { noteMetadataHelper } from "../../src/internal/note-metadata";
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
import { crossroadPath, lemmaPath, readingPath } from "../support/paths";
import { openStore, seed } from "../support/store";

const planner = createDumdictPlanner("de");
const schreitenCrossroad = "[[Worter/s/sch/schre/schreiten|schreiten]]";
const schreitenLink = `[[${lemmaPath(schreiten).slice(0, -3)}|schreiten]]`;
const gehenNote = readingPath(gehenReading);
const laufenNote = readingPath(laufenReading);
const schreitenPath = lemmaPath(schreiten);
const schreitenNote = readingPath(schreitenReading);

const schreitenDraft: AddNewNoteRequest<"de"> = {
	draft: {
		note: {
			attestationLinks: [],
			attestedTranslations: ["stride"],
			notes: "",
		},
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
	// Each source's Reading note links schreiten's Crossroad path.
	expect(opened.vault.content(gehenNote)).toContain(schreitenCrossroad);
	expect(opened.vault.content(crossroadPath("schreiten"))).toBeUndefined();
	return opened;
}

async function planSchreiten(
	store: Awaited<ReturnType<typeof openStore>>["store"],
) {
	const context = await run(
		store.loadReadingEntryContext(
			planner.contextRequest({
				intent: "addNewNote",
				request: schreitenDraft,
			}),
		),
	);
	if (context.intent !== "addNewNote") throw new Error("Expected addNewNote");
	const outcome = planner.addNewNote(context, schreitenDraft);
	if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
	return outcome.plan;
}

const synonymsOf = async (
	store: Awaited<ReturnType<typeof openStore>>["store"],
	lemma: typeof gehen,
) =>
	(await run(store.lemmaNote(lemma)))?.readings[0]?.knowledge
		?.semanticRelations;

/** The paths of one batch, sorted. */
const pathsOf = (batch: readonly { payload: unknown }[] = []) =>
	batch
		.map(({ payload }) => {
			const { splitPath } = payload as {
				splitPath: { pathParts: string[]; basename: string };
			};
			return `${[...splitPath.pathParts, splitPath.basename].join("/")}.md`;
		})
		.sort();

describe("a commit that touches several notes", () => {
	test("writes a Lemma note, Reading notes, a Crossroad note and the inverse-relation target, in order", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		const start = vault.batches.length;
		expect(await run(store.commitChanges(plan))).toMatchObject({
			status: "committed",
		});

		const batches = vault.batches.slice(start);
		// Creates first, then the sources whose records change, then the
		// notes that only show the change.
		expect(batches.map((batch) => batch.map(({ kind }) => kind))).toEqual([
			[VaultActionKind.CreateMdFile, VaultActionKind.CreateMdFile],
			[VaultActionKind.ProcessMdFile, VaultActionKind.ProcessMdFile],
			[VaultActionKind.CreateMdFile],
		]);
		expect(batches.map(pathsOf)).toEqual([
			[schreitenPath, schreitenNote].sort(),
			[gehenNote, laufenNote].sort(),
			[crossroadPath("schreiten")],
		]);
		expect(await synonymsOf(store, gehen)).toEqual({
			synonym: [schreiten],
		});
		expect(await synonymsOf(store, laufen)).toEqual({
			synonym: [schreiten],
		});
		// The resolved claims link schreiten's Lemma note now, and schreiten's
		// Reading note shows both as inverse relations.
		expect(vault.content(gehenNote)).toContain(schreitenLink);
		expect(vault.content(gehenNote)).not.toContain(schreitenCrossroad);
		expect(vault.content(schreitenNote)).toContain(
			`= [[${lemmaPath(gehen).slice(0, -3)}|gehen]], [[${lemmaPath(laufen).slice(0, -3)}|laufen]]`,
		);
		expect(vault.content(crossroadPath("schreiten"))).toContain(
			`${schreitenLink} (VERB)`,
		);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a write that fails once part-way is finished from the files", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		vault.failNextWrite((_action, path) => path === laufenNote);

		expect(await run(store.commitChanges(plan))).toMatchObject({
			status: "committed",
		});
		expect(await synonymsOf(store, gehen)).toEqual({
			synonym: [schreiten],
		});
		expect(await synonymsOf(store, laufen)).toEqual({
			synonym: [schreiten],
		});
		expect(vault.content(laufenNote)).toContain(schreitenLink);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a write that keeps failing leaves the index rebuilt to match the files, and links converge after", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		const before = await run(store.revision);
		vault.failNextWrite((_action, path) => path === laufenNote, 1000);

		const failure = await run(store.commitChanges(plan)).catch(
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(DictionaryWriteError);
		expect(failure).toMatchObject({
			executed: [schreitenPath, schreitenNote, gehenNote],
			rebuilt: true,
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
		expect(vault.content(laufenNote)).toContain(schreitenCrossroad);
		await expectIndexMatchesFiles(store, vault);
		expect(await run(store.revision)).not.toBe(before);

		// Once writes work again, a store built from the same files
		// re-evaluates laufen's Shadow, which now names schreiten alone.
		vault.failNextWrite(() => false);
		const fresh = await openStore(vault);
		expect(await synonymsOf(fresh.store, laufen)).toEqual({
			synonym: [schreiten],
		});
		expect(vault.content(laufenNote)).toContain(schreitenLink);
		expect(vault.content(schreitenNote)).toContain(
			`[[${lemmaPath(laufen).slice(0, -3)}|laufen]]`,
		);
		await expectIndexMatchesFiles(fresh.store, vault);
	});

	test("a failure twice in a row ends in a rebuild whose re-evaluation lets links converge", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		vault.failNextWrite((_action, path) => path === laufenNote, 2);

		const failure = await run(store.commitChanges(plan)).catch(
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(DictionaryWriteError);
		// The rebuild's re-evaluation resolved laufen's Shadow after all.
		expect(await synonymsOf(store, laufen)).toEqual({
			synonym: [schreiten],
		});
		expect(
			(await run(store.lemmaNote(laufen)))?.pendingRelations,
		).toMatchObject([{ resolvedLemma: schreiten }]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a create that fails takes the notes it created back, writing nothing", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		const files = vault.markdownPaths();
		vault.failNextWrite((_action, path) => path === schreitenNote);

		expect(await run(store.commitChanges(plan))).toMatchObject({
			code: "revisionConflict",
			status: "conflict",
		});
		expect(vault.markdownPaths()).toEqual(files);
		expect(await run(store.lemmaNote(schreiten))).toBeUndefined();
		await expectIndexMatchesFiles(store, vault);
	});

	test("a note edited between the commit's read and its write keeps the edit", async () => {
		const { store, vault } = await pendingDictionary();
		const plan = await planSchreiten(store);
		const typed = "A line typed while the commit ran.";
		const edited = noteMetadataHelper.mapBody(
			(body) => `${body.trimEnd()}\n\n${typed}\n`,
		)(vault.content(laufenNote) ?? "");
		// The edit lands just before laufen's write runs; its compare-and-swap
		// refuses, and the commit is finished over the edited file.
		let typing = true;
		vault.failNextWrite((_action, path) => {
			if (typing && path === laufenNote) {
				vault.silentWrite(laufenNote, edited);
				typing = false;
			}
			return false;
		});

		expect(await run(store.commitChanges(plan))).toMatchObject({
			status: "committed",
		});
		expect(vault.content(laufenNote)).toContain(typed);
		expect(vault.content(laufenNote)).toContain(schreitenLink);
		await expectIndexMatchesFiles(store, vault);
	});
});
