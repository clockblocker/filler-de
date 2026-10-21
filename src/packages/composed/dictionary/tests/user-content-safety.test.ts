import { describe, expect, test } from "bun:test";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { PlannedChangeOp } from "dumdict";
import {
	createMemoryNoteCache,
	DictionaryPathOccupiedError,
	DictionaryRequestError,
} from "../src";
import { FakeVault } from "./support/fake-vault";
import { expectIndexMatchesFiles, run } from "./support/files";
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
	synonym,
	verb,
} from "./support/fixtures";
import { crossroadPath, lemmaPath, readingPath } from "./support/paths";
import { commit, openStore, seed } from "./support/store";

const gehenPath = lemmaPath(gehen);
const gehenReadingPath = readingPath(gehenReading);
const laufenPath = lemmaPath(laufen);
const laufenReadingPath = readingPath(laufenReading);
/** Where schreiten's Crossroad note goes, and the link a pending relation writes to it. */
const schreitenCrossroadPath = "Worter/s/sch/schre/schreiten.md";
const schreitenCrossroad = "[[Worter/s/sch/schre/schreiten|schreiten]]";
const deletePending = (
	reading: typeof gehenReading,
): PlannedChangeOp<"de"> => ({
	preconditions: [],
	record: pendingFrom(reading),
	type: "deletePendingSemanticRelation",
});

async function withPendingGehen() {
	const opened = await openStore();
	await seed(opened.store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
		createLemma(laufen),
		createReading(readingEntry(laufenReading)),
		createPending(pendingFrom(gehenReading)),
	]);
	expect(opened.vault.markdownPaths()).toEqual(
		[
			gehenPath,
			gehenReadingPath,
			laufenPath,
			laufenReadingPath,
			crossroadPath("gehen"),
			crossroadPath("laufen"),
		].sort(),
	);
	return opened;
}

describe("a pending relation's target", () => {
	test("its link points at the Crossroad path and stays put once a note is created there", async () => {
		const { store, vault } = await withPendingGehen();
		const before = vault.content(gehenReadingPath) ?? "";
		expect(before).toContain(schreitenCrossroad);
		// Clicking the uncreated link makes Obsidian create an empty note there.
		await vault.userWrite(schreitenCrossroadPath, "");
		expect(vault.content(gehenReadingPath)).toBe(before);
		expect(
			`${schreitenCrossroad.slice(2, -"|schreiten]]".length)}.md`,
		).toBe(schreitenCrossroadPath);
		// The store fills the new note as a Crossroad that is not classified
		// yet, and generates nothing else for it.
		const filled = vault.content(schreitenCrossroadPath);
		expect(filled).toContain("*Not classified yet*");
		await seed(store, [createPending(pendingFrom(laufenReading))]);
		expect(vault.content(laufenReadingPath)).toContain(schreitenCrossroad);
		expect(vault.content(schreitenCrossroadPath)).toBe(filled);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a note at an old Shadow path is never read, written or removed", async () => {
		const oldShadow = "Worter/de/Shadow/Lexeme/VERB/schreiten.md";
		const vault = new FakeVault({ [oldShadow]: "schreiten, my notes" });
		const { store } = await openStore(vault);
		await seed(store, [
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
			createPending(pendingFrom(gehenReading)),
		]);
		await seed(store, [deletePending(gehenReading)]);
		expect(vault.content(oldShadow)).toBe("schreiten, my notes");
		expect(vault.markdownPaths()).toEqual(
			[
				gehenPath,
				gehenReadingPath,
				crossroadPath("gehen"),
				oldShadow,
			].sort(),
		);
		expect((await run(store.diagnostics)).quarantined).toMatchObject([
			{ path: oldShadow, reason: { _tag: "InvalidNote" } },
		]);
	});

	test("an empty file at a Lemma's exact path is reported and left alone", async () => {
		const vault = new FakeVault({ [gehenPath]: "" });
		const { store } = await openStore(vault);
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.emptyNotes).toEqual([gehenPath]);
		expect(diagnostics.quarantined).toEqual([]);
		const refused = await commit(store, [createLemma(gehen)]).catch(
			(error: unknown) => error,
		);
		expect(refused).toBeInstanceOf(DictionaryPathOccupiedError);
		expect(vault.content(gehenPath)).toBe("");
	});
});

describe("creates never overwrite", () => {
	test("a file at the identity path the index has not seen sends the commit back to re-plan", async () => {
		const { store, vault } = await openStore();
		vault.silentWrite(gehenPath, "a note the user is typing");
		expect(await commit(store, [createLemma(gehen)])).toMatchObject({
			code: "revisionConflict",
			status: "conflict",
		});
		expect(vault.content(gehenPath)).toBe("a note the user is typing");
		expect((await run(store.diagnostics)).quarantined).toMatchObject([
			{ path: gehenPath, reason: { _tag: "InvalidNote" } },
		]);
	});

	test("a file that appears just before the create is dispatched is kept", async () => {
		const { store, vault } = await openStore();
		vault.failNextWrite((action, path) => {
			if (
				action.kind === VaultActionKind.CreateFile &&
				path === gehenPath
			)
				vault.silentWrite(gehenPath, "raced in");
			return false;
		});
		expect(await commit(store, [createLemma(gehen)])).toMatchObject({
			code: "revisionConflict",
			status: "conflict",
		});
		expect(vault.content(gehenPath)).toBe("raced in");
	});

	test("a file at a pending target's Crossroad path does not hold up the commit", async () => {
		const opened = await openStore();
		await seed(opened.store, [
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		opened.vault.silentWrite(schreitenCrossroadPath, "mine");
		await seed(opened.store, [createPending(pendingFrom(gehenReading))]);
		expect(opened.vault.content(schreitenCrossroadPath)).toBe("mine");
		expect(opened.vault.content(gehenReadingPath)).toContain(
			schreitenCrossroad,
		);
	});
});

describe("healing", () => {
	test("a note whose identity path holds another file stays put and is reported", async () => {
		const { store, vault } = await withPendingGehen();
		const note = vault.content(gehenPath) ?? "";
		vault.silentWrite("Worter/de/moved.md", note);
		await vault.userWrite(gehenPath, "another file");
		await vault.echo("Worter/de/moved.md");
		expect(vault.content(gehenPath)).toBe("another file");
		expect(vault.content("Worter/de/moved.md")).toBe(note);
		expect((await run(store.diagnostics)).healingBlocked).toMatchObject([
			{ canonicalPath: gehenPath, path: "Worter/de/moved.md" },
		]);
	});

	test("a move VAM puts aside on a collision is learned from the files", async () => {
		const { store, vault } = await withPendingGehen();
		const note = vault.content(gehenPath) ?? "";
		// Healing the hand rename races a file into the identity path.
		vault.failNextWrite((action) => {
			if (action.kind === VaultActionKind.RenameMdFile)
				vault.silentWrite(gehenPath, "raced in");
			return false;
		});
		await vault.userRename(gehenPath, "Worter/de/moved.md");
		expect(vault.content(gehenPath)).toBe("raced in");
		expect(vault.content("Worter/de/moved.md")).toBeUndefined();
		const aside = `${gehenPath.slice(0, -3)} 1.md`;
		expect(vault.content(aside)).toBe(note);
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(aside);
		await expectIndexMatchesFiles(store, vault);
	});
});

test("a heal move that keeps failing is reported and not retried on every event", async () => {
	const { store, vault } = await withPendingGehen();
	vault.failNextWrite(
		(action) => action.kind === VaultActionKind.RenameMdFile,
		1000,
	);
	await vault.userRename(gehenPath, "Worter/de/moved.md");
	expect((await run(store.diagnostics)).healingBlocked).toMatchObject([
		{ canonicalPath: gehenPath, path: "Worter/de/moved.md" },
	]);
	const scans = vault.scanCount;
	const revision = await run(store.revision);
	await vault.userWrite(laufenPath, `${vault.content(laufenPath)}\nedited\n`);
	expect(vault.scanCount).toBe(scans);
	expect(await run(store.revision)).not.toBe(revision);
	expect(vault.content("Worter/de/moved.md")).toBeDefined();
});

describe("failures leave the index honest", () => {
	test("a scan that fails while handling an event makes the next commit rebuild first", async () => {
		const { store, vault } = await withPendingGehen();
		const before = await run(store.revision);
		vault.failNextScans(1);
		await vault.userRenameFolder(
			"Worter/de/Lexeme/VERB",
			"Worter/de/Lexeme/Verben",
		);
		expect(
			await run(
				store.commitChanges({
					baseRevision: before,
					changes: [synonym(gehenReading, laufen)],
				}),
			),
		).toMatchObject({ code: "revisionConflict" });
		await seed(store, [synonym(gehenReading, laufen)]);
		expect(vault.content(gehenReadingPath)).toContain("laufen");
		await expectIndexMatchesFiles(store, vault);
	});

	test("an unreadable file moves the revision once, not on every event", async () => {
		const { store, vault } = await withPendingGehen();
		vault.unreadable.add(gehenPath);
		await vault.echo(gehenPath);
		const once = await run(store.revision);
		await vault.echo(gehenPath);
		await vault.echo(gehenPath);
		expect(await run(store.revision)).toBe(once);
		expect((await run(store.diagnostics)).quarantined).toMatchObject([
			{ path: gehenPath, reason: { _tag: "Unreadable" } },
			{ path: gehenReadingPath, reason: { _tag: "OrphanReading" } },
		]);
	});

	test("a cache from another version misses", async () => {
		const { vault } = await withPendingGehen();
		const cache = createMemoryNoteCache();
		await openStore(vault, cache);
		for (const [path, note] of cache.entries())
			cache.set(path, { ...note, version: "older" });
		vault.readCount.clear();
		await openStore(vault, cache);
		expect(vault.readCount.get(gehenPath)).toBe(1);
	});
});

test("the relation inventory is capped at 100 Lemmas, nearest first, and refuses a plan that names more", async () => {
	const { store } = await openStore();
	const others = Array.from({ length: 150 }, (_, index) =>
		verb(`verb${String(index).padStart(3, "0")}en`),
	);
	await seed(store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
		...others.map(createLemma),
	]);
	const load = (targets: typeof others) =>
		run(
			store.loadReadingEntryContext({
				intent: "applyGeneratedKnowledge",
				pendingRelations: [],
				reading: gehenReading,
				relationTargetLemmas: targets,
				relationTargetReadings: [],
			}),
		);
	const context = await load(others.slice(0, 99));
	if (context.intent !== "applyGeneratedKnowledge") throw new Error();
	expect(context.relationLemmas.map(({ lemma }) => lemma)).toEqual([
		gehen,
		...others.slice(0, 99),
	]);
	expect(context.relationReadings.map(({ reading }) => reading)).toEqual([
		gehenReading,
	]);
	expect(await load(others.slice(0, 99))).toEqual(context);
	expect(await load(others).catch((error: unknown) => error)).toBeInstanceOf(
		DictionaryRequestError,
	);
});
