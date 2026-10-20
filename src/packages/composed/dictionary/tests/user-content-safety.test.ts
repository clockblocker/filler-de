import { describe, expect, test } from "bun:test";
import { lemmaNotePath } from "@textfresser/lemma-note-codec";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { PlannedChangeOp } from "dumdict";
import { createMemoryNoteCache } from "../src";
import { shadowBody } from "../src/shadow-note";
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
	schreitenShadow,
	synonym,
	verb,
} from "./support/fixtures";
import { commit, openStore, seed } from "./support/store";

const gehenPath = lemmaNotePath(gehen).path;
const shadowPath = "Worter/de/Shadow/Lexeme/VERB/schreiten.md";
const storeShadow = shadowBody(schreitenShadow.target);
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
	expect(opened.vault.content(shadowPath)).toBe(storeShadow);
	return opened;
}

describe("Shadow notes", () => {
	test("user content in a Shadow survives the deletion of its last relation", async () => {
		const { store, vault } = await withPendingGehen();
		const written = `${storeShadow}\nMy own note about schreiten.\n`;
		await vault.userWrite(shadowPath, written);

		await seed(store, [deletePending(gehenReading)]);
		expect(vault.content(shadowPath)).toBe(written);
		expect((await run(store.diagnostics)).userShadows).toEqual([
			shadowPath,
		]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a Shadow edited between the commit's check and its dispatch is kept", async () => {
		const { store, vault } = await withPendingGehen();
		const edited = `${storeShadow}typed just now\n`;
		vault.failNextWrite((action, path) => {
			if (
				action.kind === VaultActionKind.ProcessMdFile &&
				path === shadowPath
			)
				vault.silentWrite(shadowPath, edited);
			return false;
		});
		await commit(store, [deletePending(gehenReading)]).catch(
			() => undefined,
		);
		expect(vault.content(shadowPath)).toBe(edited);
	});

	test("an orphan Shadow the store wrote is cleaned up; one the user changed stays", async () => {
		const userOrphan = "Worter/de/Shadow/Lexeme/VERB/springen.md";
		const vault = new FakeVault({
			[shadowPath]: storeShadow,
			[userOrphan]: "springen, my notes",
		});
		const { store } = await openStore(vault);
		expect(vault.content(shadowPath)).toBeUndefined();
		expect(vault.content(userOrphan)).toBe("springen, my notes");
		expect((await run(store.diagnostics)).userShadows).toEqual([
			userOrphan,
		]);
	});

	test("a Shadow the user deleted comes back with the next commit touching its relations, not on the event", async () => {
		const { store, vault } = await withPendingGehen();
		await vault.userDelete(shadowPath);
		expect(vault.content(shadowPath)).toBeUndefined();

		await seed(store, [createPending(pendingFrom(laufenReading))]);
		expect(vault.content(shadowPath)).toBe(storeShadow);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a quarantined note's pending relations keep their Shadow", async () => {
		const { store, vault } = await withPendingGehen();
		// A wrong Block ID quarantines the note but leaves its records readable.
		const broken = (vault.content(gehenPath) ?? "").replace(
			/%%tf-part:reading r-[0-9a-f]+%%/,
			"%%tf-part:reading r-00000000%%",
		);
		await vault.userWrite(gehenPath, broken);
		expect((await run(store.diagnostics)).quarantined).toMatchObject([
			{ path: gehenPath },
		]);
		expect(vault.content(shadowPath)).toBe(storeShadow);
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

	test("a Shadow path holding an unseen file sends the commit back to re-plan", async () => {
		const opened = await openStore();
		await seed(opened.store, [
			createLemma(gehen),
			createReading(readingEntry(gehenReading)),
		]);
		opened.vault.silentWrite(shadowPath, "mine");
		expect(
			await commit(opened.store, [
				createPending(pendingFrom(gehenReading)),
			]),
		).toMatchObject({ code: "revisionConflict" });
		expect(opened.vault.content(shadowPath)).toBe("mine");
		await seed(opened.store, [createPending(pendingFrom(gehenReading))]);
		expect(opened.vault.content(shadowPath)).toBe("mine");
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
		expect(vault.content(gehenPath)).toContain("laufen");
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

test("the relation inventory is capped at 100 Lemmas, nearest first and deterministic", async () => {
	const { store } = await openStore();
	const others = Array.from({ length: 150 }, (_, index) =>
		verb(`verb${String(index).padStart(3, "0")}en`),
	);
	await seed(store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
		...others.map(createLemma),
	]);
	const load = () =>
		run(
			store.loadReadingEntryContext({
				intent: "applyGeneratedKnowledge",
				pendingRelations: [],
				reading: gehenReading,
				relationTargetLemmas: others,
				relationTargetReadings: [],
			}),
		);
	const context = await load();
	if (context.intent !== "applyGeneratedKnowledge") throw new Error();
	expect(context.relationLemmas).toHaveLength(100);
	expect(context.relationLemmas[0]?.lemma).toEqual(gehen);
	expect(context.relationLemmas.slice(1).map(({ lemma }) => lemma)).toEqual(
		others.slice(0, 99),
	);
	expect(context.relationReadings.map(({ reading }) => reading)).toEqual([
		gehenReading,
	]);
	expect(await load()).toEqual(context);
});
