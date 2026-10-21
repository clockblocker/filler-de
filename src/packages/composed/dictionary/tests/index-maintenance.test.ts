import { describe, expect, test } from "bun:test";
import {
	legacyLemmaNotePath,
	parse,
	serialize,
} from "@textfresser/lemma-note-codec";
import { createMemoryNoteCache, DictionaryPathOccupiedError } from "../src";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	contribute,
	createLemma,
	createPending,
	createReading,
	createSurface,
	gehen,
	gehenReading,
	gehtSurfaceEntry,
	laufen,
	laufenReading,
	pendingFrom,
	readingEntry,
	springen,
	synonym,
} from "./support/fixtures";
import { commit, openStore, seed } from "./support/store";

const gehenPath = legacyLemmaNotePath(gehen).path;
const laufenPath = legacyLemmaNotePath(laufen).path;
const schreitenCrossroad = "[[Worter/s/sch/schre/schreiten|schreiten]]";

async function seededStore() {
	const opened = await openStore();
	await seed(opened.store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading, { notes: "first" })),
		createSurface(gehtSurfaceEntry),
		createLemma(laufen),
		createReading(readingEntry(laufenReading)),
	]);
	return opened;
}

/** The note at `path` with its gehen Reading's notes replaced, as a hand edit would leave it. */
function editedNotes(content: string, notes: string): string {
	const { data, document } = parse(content, { language: "de" });
	if (!data.ok) throw new Error("Expected a valid note");
	return serialize(document, {
		...data.data,
		readingEntries: data.data.readingEntries.map((entry) => ({
			...entry,
			notes,
		})),
	});
}

const notesOf = async (store: Awaited<ReturnType<typeof openStore>>["store"]) =>
	(await run(store.lemmaNote(gehen)))?.readings.map((entry) => entry.notes);

describe("building the index", () => {
	test("reads every note at startup and serves the same reads as the store that wrote them", async () => {
		const { store, vault } = await seededStore();
		await run(store.close);
		const reopened = await openStore(vault);
		expect(await run(reopened.store.lemmaNote(gehen))).toEqual(
			await run(store.lemmaNote(gehen)),
		);
		await expectIndexMatchesFiles(reopened.store, vault);
	});

	test("a (path, mtime) cache skips reading unchanged notes", async () => {
		const { vault } = await seededStore();
		const cache = createMemoryNoteCache();
		await openStore(vault, cache);
		expect(cache.entries().size).toBe(2);
		vault.readCount.clear();

		const cached = await openStore(vault, cache);
		expect(vault.readCount.size).toBe(0);
		await expectIndexMatchesFiles(cached.store, vault);

		vault.silentWrite(
			gehenPath,
			editedNotes(vault.content(gehenPath) ?? "", "changed"),
		);
		const refreshed = await openStore(vault, cache);
		expect([...vault.readCount.keys()]).toEqual([gehenPath]);
		expect(await notesOf(refreshed.store)).toEqual(["changed"]);
	});
});

describe("keeping the index current", () => {
	test("a hand edit is re-read and moves the revision", async () => {
		const { store, vault } = await seededStore();
		const before = await run(store.revision);
		await vault.userWrite(
			gehenPath,
			editedNotes(vault.content(gehenPath) ?? "", "by hand"),
		);
		expect(await notesOf(store)).toEqual(["by hand"]);
		expect(await run(store.revision)).not.toBe(before);
		await expectIndexMatchesFiles(store, vault);
	});

	test("an echo of the store's own write is a no-op", async () => {
		const { store, vault } = await seededStore();
		await seed(store, [contribute(gehenReading, "sich fortbewegen")]);
		const revision = await run(store.revision);
		vault.readCount.clear();

		await vault.echo(gehenPath);
		expect(await run(store.revision)).toBe(revision);
		expect(vault.readCount.get(gehenPath)).toBe(1);
		expect(
			await commit(store, [contribute(laufenReading, "rennen")]),
		).toMatchObject({ status: "committed" });
	});

	test("a plan made before a hand edit is refused", async () => {
		const { store, vault } = await seededStore();
		const revision = await run(store.revision);
		await vault.userWrite(
			gehenPath,
			editedNotes(vault.content(gehenPath) ?? "", "by hand"),
		);
		expect(
			await run(
				store.commitChanges({
					baseRevision: revision,
					changes: [contribute(gehenReading, "x")],
				}),
			),
		).toMatchObject({ code: "revisionConflict", status: "conflict" });
		expect(await notesOf(store)).toEqual(["by hand"]);
	});

	test("an edit no event reported is caught at commit and refused", async () => {
		const { store, vault } = await seededStore();
		vault.silentWrite(
			gehenPath,
			editedNotes(vault.content(gehenPath) ?? "", "unseen"),
		);
		expect(
			await commit(store, [contribute(gehenReading, "x")]),
		).toMatchObject({ code: "revisionConflict", status: "conflict" });
		// The refusal re-read the note, so the edit survives and a re-plan commits.
		expect(await notesOf(store)).toEqual(["unseen"]);
		await seed(store, [contribute(gehenReading, "x")]);
		expect(await notesOf(store)).toEqual(["unseen"]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a note renamed by hand is healed back to its identity path", async () => {
		const { store, vault } = await seededStore();
		await vault.userRename(gehenPath, "Worter/de/gehen.md");
		expect(vault.content("Worter/de/gehen.md")).toBeUndefined();
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(gehenPath);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a renamed folder is re-read and its notes healed", async () => {
		const { store, vault } = await seededStore();
		await vault.userRenameFolder(
			"Worter/de/Lexeme/VERB",
			"Worter/de/Lexeme/Verben",
		);
		expect(vault.markdownPaths()).toEqual([laufenPath, gehenPath].sort());
		await expectIndexMatchesFiles(store, vault);
	});

	test("a deleted note leaves the dictionary", async () => {
		const { store, vault } = await seededStore();
		await vault.userDelete(gehenPath);
		expect(await run(store.lemmaNote(gehen))).toBeUndefined();
		expect(await commit(store, [createLemma(gehen)])).toMatchObject({
			status: "committed",
		});
	});

	test("a hand-made note at an identity path joins the dictionary", async () => {
		const { store, vault } = await seededStore();
		const springenNote = serialize(undefined, {
			lemmaRecord: { lemma: springen },
			ownedSurfaceEntries: [],
			pendingRelations: [],
			readingEntries: [],
		});
		await vault.userWrite(legacyLemmaNotePath(springen).path, springenNote);
		expect((await run(store.lemmaNote(springen)))?.path).toBe(
			legacyLemmaNotePath(springen).path,
		);
	});
});

describe("quarantine", () => {
	test("a note the codec rejects is reported, unread and never overwritten", async () => {
		const { store, vault, reports } = await seededStore();
		await vault.userWrite(
			gehenPath,
			"%%tf-part:lemma%%\n\n%%tf:identity {broken%%\n",
		);
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.quarantined).toMatchObject([
			{ path: gehenPath, reason: { _tag: "InvalidNote" } },
		]);
		expect(reports.at(-1)).toEqual(diagnostics);
		expect(await run(store.lemmaNote(gehen))).toBeUndefined();

		const refused = await run(
			store.commitChanges({
				baseRevision: await run(store.revision),
				changes: [createLemma(gehen)],
			}),
		).catch((error: unknown) => error);
		expect(refused).toBeInstanceOf(DictionaryPathOccupiedError);
		expect(vault.content(gehenPath)).toContain("{broken");
	});

	test("a second note of one Lemma is a duplicate; the one at the identity path holds it", async () => {
		const { store, vault } = await seededStore();
		const copy = vault.content(gehenPath) ?? "";
		await vault.userWrite("Worter/de/copy.md", copy);
		expect((await run(store.diagnostics)).quarantined).toEqual([
			{
				path: "Worter/de/copy.md",
				reason: { _tag: "DuplicateLemma", heldBy: gehenPath },
			},
		]);
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(gehenPath);
		await seed(store, [contribute(gehenReading, "x")]);
		expect(vault.content("Worter/de/copy.md")).toBe(copy);
		expect(vault.content(gehenPath)).not.toBe(copy);
	});
});

describe("lookups", () => {
	test("finds Lemma candidates by Canonical Form and owned Surface, without case", async () => {
		const { store } = await seededStore();
		expect(
			await run(
				store.lemmaCandidates(["geht", "GEHEN", "Laufen", "nichts"]),
			),
		).toEqual([
			{ foundUnder: ["geht", "GEHEN"], lemma: gehen },
			{ foundUnder: ["Laufen"], lemma: laufen },
		]);
	});

	test("locates a Reading's Block and indexes relation edges by target", async () => {
		const { store } = await seededStore();
		await seed(store, [synonym(gehenReading, laufen)]);
		const location = await run(store.readingLocation(gehenReading));
		expect(location?.path).toBe(gehenPath);
		expect(location?.blockId).toMatch(/^r-[0-9a-f]{8}$/);
		expect(await run(store.relationEdgesTo(laufen))).toEqual([
			{
				relation: "synonym",
				source: gehenReading,
				target: { kind: "lemma", lemma: laufen },
			},
		]);
	});

	test("a pending relation lives only in its source note and round-trips through it", async () => {
		const { store, vault } = await seededStore();
		await seed(store, [createPending(pendingFrom(gehenReading))]);
		// No other note holds it, or a placeholder for its target.
		expect(vault.markdownPaths().sort()).toEqual([gehenPath, laufenPath]);
		expect(vault.content(gehenPath)).toContain(schreitenCrossroad);
		expect(vault.content(laufenPath)).not.toContain("schreiten");

		const reopened = await openStore(vault);
		expect(
			(await run(reopened.store.lemmaNote(gehen)))?.pendingRelations,
		).toEqual([pendingFrom(gehenReading)]);

		await seed(reopened.store, [
			{
				preconditions: [],
				record: pendingFrom(gehenReading),
				type: "deletePendingSemanticRelation",
			},
		]);
		expect(vault.markdownPaths().sort()).toEqual([gehenPath, laufenPath]);
		expect(vault.content(gehenPath)).not.toContain("schreiten");
		expect(
			(await run(reopened.store.lemmaNote(gehen)))?.pendingRelations,
		).toEqual([]);
		await expectIndexMatchesFiles(reopened.store, vault);
	});

	test("a relation slice holds the neighbourhood, not the whole dictionary", async () => {
		const { store } = await seededStore();
		await seed(store, [createLemma(springen)]);
		const context = await run(
			store.loadReadingEntryContext({
				intent: "applyGeneratedKnowledge",
				pendingRelations: [],
				reading: gehenReading,
				relationTargetLemmas: [springen],
				relationTargetReadings: [],
			}),
		);
		if (context.intent !== "applyGeneratedKnowledge") throw new Error();
		expect(
			context.relationLemmas
				.map(({ lemma }) => lemma.canonicalForm)
				.sort(),
		).toEqual(["gehen", "springen"]);
		expect(context.relationReadings.map(({ reading }) => reading)).toEqual([
			gehenReading,
		]);
	});

	test("close stops observing the vault", async () => {
		const { store, vault } = await seededStore();
		expect(vault.subscriberCount).toBe(2);
		await run(store.close);
		expect(vault.subscriberCount).toBe(0);
	});
});
