import { describe, expect, test } from "bun:test";
import { writeLemmaNote } from "../../../../stateless-helpers/dictionary-notes";
import {
	createMemoryNoteCache,
	DICTIONARY_CALLER,
	DictionaryPathOccupiedError,
} from "../src";
import { vamWrite } from "./support/fake-vault";
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
	readingOf,
	springen,
	synonym,
} from "./support/fixtures";
import {
	crossroadPath,
	lemmaPath,
	readingPath,
	withReadingNotes,
} from "./support/paths";
import { commit, openStore, seed } from "./support/store";

const gehenPath = lemmaPath(gehen);
const gehenReadingPath = readingPath(gehenReading);
const laufenPath = lemmaPath(laufen);
const laufenReadingPath = readingPath(laufenReading);
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

const notesOf = async (store: Awaited<ReturnType<typeof openStore>>["store"]) =>
	(await run(store.lemmaNote(gehen)))?.readings.map((entry) => entry.notes);

describe("the notes of a Lemma", () => {
	test("a Lemma note, a Reading note per Reading and a Crossroad note per spelling", async () => {
		const { vault } = await seededStore();
		expect(vault.markdownPaths()).toEqual(
			[
				gehenPath,
				gehenReadingPath,
				laufenPath,
				laufenReadingPath,
				crossroadPath("gehen"),
				crossroadPath("geht"),
				crossroadPath("laufen"),
			].sort(),
		);
		expect(gehenReadingPath).toBe(
			"Worter/de/Lexeme/VERB/g/geh/gehen/🚶 gehen.md",
		);
		expect(vault.content(crossroadPath("geht"))).toContain(
			"[[Worter/de/Lexeme/VERB/g/geh/gehen/gehen|gehen]]",
		);
	});
});

describe("building the index", () => {
	test("reads every note at startup and serves the same reads as the store that wrote them", async () => {
		const { store, vault } = await seededStore();
		await run(store.close);
		const batches = vault.batches.length;
		const reopened = await openStore(vault);
		expect(await run(reopened.store.lemmaNote(gehen))).toEqual(
			await run(store.lemmaNote(gehen)),
		);
		await expectIndexMatchesFiles(reopened.store, vault);
		// Opening writes nothing.
		expect(vault.batches).toHaveLength(batches);
	});

	test("a (path, mtime) cache skips reading unchanged notes", async () => {
		const { vault } = await seededStore();
		const cache = createMemoryNoteCache();
		await openStore(vault, cache);
		expect(cache.entries().size).toBe(7);
		vault.readCount.clear();

		const cached = await openStore(vault, cache);
		expect(vault.readCount.size).toBe(0);
		await expectIndexMatchesFiles(cached.store, vault);

		vault.silentWrite(
			gehenReadingPath,
			withReadingNotes(vault.content(gehenReadingPath) ?? "", "changed"),
		);
		const refreshed = await openStore(vault, cache);
		expect([...vault.readCount.keys()]).toEqual([gehenReadingPath]);
		expect(await notesOf(refreshed.store)).toEqual(["changed"]);
	});
});

describe("keeping the index current", () => {
	test("a hand edit is re-read and moves the revision", async () => {
		const { store, vault } = await seededStore();
		const before = await run(store.revision);
		await vault.userWrite(
			gehenReadingPath,
			withReadingNotes(vault.content(gehenReadingPath) ?? "", "by hand"),
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

		await vault.echo(gehenReadingPath);
		expect(await run(store.revision)).toBe(revision);
		expect(vault.readCount.get(gehenReadingPath)).toBe(1);
		expect(
			await commit(store, [contribute(laufenReading, "rennen")]),
		).toMatchObject({ status: "committed" });
	});

	test("a plan made before a hand edit is refused", async () => {
		const { store, vault } = await seededStore();
		const revision = await run(store.revision);
		await vault.userWrite(
			gehenReadingPath,
			withReadingNotes(vault.content(gehenReadingPath) ?? "", "by hand"),
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
			gehenReadingPath,
			withReadingNotes(vault.content(gehenReadingPath) ?? "", "unseen"),
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

	test("a Lemma note renamed by hand is healed back to its identity path", async () => {
		const { store, vault } = await seededStore();
		await vault.userRename(gehenPath, "Worter/de/gehen.md");
		expect(vault.content("Worter/de/gehen.md")).toBeUndefined();
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(gehenPath);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a Reading note renamed by hand is healed back to its identity path", async () => {
		const { store, vault } = await seededStore();
		const renamed = "Worter/de/Lexeme/VERB/g/geh/gehen/walking.md";
		await vault.userRename(gehenReadingPath, renamed);
		expect(vault.content(renamed)).toBeUndefined();
		expect((await run(store.readingLocation(gehenReading)))?.path).toBe(
			gehenReadingPath,
		);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a Reading note outside its Lemma's folder is moved back into it", async () => {
		const { store, vault } = await seededStore();
		const away = "Worter/de/Lexeme/VERB/l/lau/laufe/🚶 gehen.md";
		await vault.userRename(gehenReadingPath, away);
		expect(vault.content(away)).toBeUndefined();
		expect(vault.content(gehenReadingPath)).toContain("gehen");
		expect(await notesOf(store)).toEqual(["first"]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a renamed folder is re-read and its notes healed", async () => {
		const { store, vault } = await seededStore();
		const before = vault.markdownPaths();
		await vault.userRenameFolder(
			"Worter/de/Lexeme/VERB",
			"Worter/de/Lexeme/Verben",
		);
		expect(vault.markdownPaths()).toEqual(before);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a deleted Lemma note leaves its Lemma out, and its Reading notes orphaned", async () => {
		const { store, vault } = await seededStore();
		await vault.userDelete(gehenPath);
		expect(await run(store.lemmaNote(gehen))).toBeUndefined();
		expect(await run(store.readingLocation(gehenReading))).toBeUndefined();
		expect((await run(store.diagnostics)).quarantined).toEqual([
			{ path: gehenReadingPath, reason: { _tag: "OrphanReading" } },
		]);
		// The orphan keeps its text and is never removed.
		expect(vault.content(gehenReadingPath)).toContain("first");
		// A Lemma created again takes its orphaned Reading note back.
		await seed(store, [createLemma(gehen)]);
		expect(await notesOf(store)).toEqual(["first"]);
		expect((await run(store.diagnostics)).quarantined).toEqual([]);
	});

	test("a deleted Reading note leaves its Reading out and its Lemma note re-rendered", async () => {
		const { store, vault } = await seededStore();
		expect(vault.content(gehenPath)).toContain("🚶 gehen|🚶");
		await vault.userDelete(gehenReadingPath);
		expect(await run(store.readingLocation(gehenReading))).toBeUndefined();
		expect((await run(store.lemmaNote(gehen)))?.readings).toEqual([]);
		expect(vault.content(gehenPath)).not.toContain("🚶 gehen|🚶");
		await expectIndexMatchesFiles(store, vault);
	});

	test("a hand-made note at an identity path joins the dictionary", async () => {
		const { store, vault } = await seededStore();
		const springenNote = writeLemmaNote(
			{
				lemmaRecord: { lemma: springen },
				ownedSurfaceEntries: [],
				pendingRelations: [],
				readingEntries: [],
			},
			{ format: "Hidden", language: "de" },
		)("");
		await vault.userWrite(lemmaPath(springen), springenNote);
		expect((await run(store.lemmaNote(springen)))?.path).toBe(
			lemmaPath(springen),
		);
	});
});

describe("recognition", () => {
	test("a note the codec rejects is reported, unread and never overwritten", async () => {
		const { store, vault, reports } = await seededStore();
		await vault.userWrite(
			gehenPath,
			"%%tf-part:lemma%%\n\n%%tf:identity {broken%%\n",
		);
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.quarantined).toMatchObject([
			{ path: gehenPath, reason: { _tag: "InvalidNote" } },
			{ path: gehenReadingPath, reason: { _tag: "OrphanReading" } },
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
		// A new Reading changes the Lemma note's Reading links.
		await seed(store, [
			createReading(readingEntry(readingOf(gehen, "🚗"))),
		]);
		expect(vault.content("Worter/de/copy.md")).toBe(copy);
		expect(vault.content(gehenPath)).not.toBe(copy);
	});

	test("a new note Obsidian named in Worter/ is reported and left alone, never quarantined", async () => {
		const { store, vault } = await seededStore();
		await vault.userWrite("Worter/Untitled 2.md", "my own words");
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.strays).toEqual(["Worter/Untitled 2.md"]);
		expect(diagnostics.quarantined).toEqual([]);
		await seed(store, [contribute(gehenReading, "x")]);
		expect(vault.content("Worter/Untitled 2.md")).toBe("my own words");
	});

	test("an empty Crossroad note a click left is a Crossroad note, filled as not classified yet", async () => {
		const { store, vault } = await seededStore();
		const path = crossroadPath("fahrer");
		await vault.userWrite(path, "");
		const diagnostics = await run(store.diagnostics);
		expect(diagnostics.quarantined).toEqual([]);
		expect(diagnostics.strays).toEqual([]);
		expect(vault.content(path)).toContain("*Not classified yet*");
		await expectIndexMatchesFiles(store, vault);
	});

	test("an empty file at an exact Reading path is reported and left alone", async () => {
		const { store, vault } = await seededStore();
		const driving = readingOf(gehen, "🚗");
		const path = readingPath(driving);
		await vault.userWrite(path, "");
		expect((await run(store.diagnostics)).emptyNotes).toEqual([path]);
		const refused = await run(
			store.commitChanges({
				baseRevision: await run(store.revision),
				changes: [createReading(readingEntry(driving))],
			}),
		).catch((error: unknown) => error);
		expect(refused).toBeInstanceOf(DictionaryPathOccupiedError);
		expect(vault.content(path)).toBe("");
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

	test("locates a Reading's note and indexes relation edges by target", async () => {
		const { store } = await seededStore();
		await seed(store, [synonym(gehenReading, laufen)]);
		const location = await run(store.readingLocation(gehenReading));
		expect(location?.path).toBe(gehenReadingPath);
		expect(location?.lemmaPath).toBe(gehenPath);
		expect(await run(store.relationEdgesTo(laufen))).toEqual([
			{
				relation: "synonym",
				source: gehenReading,
				target: { kind: "lemma", lemma: laufen },
			},
		]);
	});

	test("a pending relation lives only in its source's Reading note and round-trips through it", async () => {
		const { store, vault } = await seededStore();
		const before = vault.markdownPaths();
		await seed(store, [createPending(pendingFrom(gehenReading))]);
		// No other note holds it, or a placeholder for its target.
		expect(vault.markdownPaths()).toEqual(before);
		expect(vault.content(gehenReadingPath)).toContain(schreitenCrossroad);
		expect(vault.content(gehenPath)).not.toContain("schreiten");

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
		expect(vault.markdownPaths()).toEqual(before);
		expect(vault.content(gehenReadingPath)).not.toContain("schreiten");
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

describe("writes of other VAM callers", () => {
	test("the metadata migration's write reaches the store, as a hand edit does", async () => {
		const { store, vault } = await seededStore();
		await vault.userWrite(
			gehenReadingPath,
			withReadingNotes(vault.content(gehenReadingPath) ?? "", "migrated"),
			vamWrite("migration"),
		);
		expect(await notesOf(store)).toEqual(["migrated"]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("the reset's backup move and the notes it writes again reach the store, with no rescan", async () => {
		const { store, vault } = await seededStore();
		const lemma = vault.content(gehenPath) ?? "";
		const reading = vault.content(gehenReadingPath) ?? "";
		await vault.userRenameFolder(
			"Worter",
			"Worter backup",
			vamWrite("reset"),
		);
		expect(await run(store.lemmaNotes)).toEqual([]);

		await vault.userWrite(gehenPath, lemma, vamWrite("reset"));
		await vault.userWrite(gehenReadingPath, reading, vamWrite("reset"));
		// Handled idempotently: the same write heard twice changes nothing.
		await vault.userWrite(gehenReadingPath, reading, vamWrite("reset"));
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(gehenPath);
		expect(await notesOf(store)).toEqual(["first"]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("the store's own writes are not delivered back to it", async () => {
		const { store, vault } = await seededStore();
		vault.readCount.clear();
		await vault.userWrite(
			gehenReadingPath,
			withReadingNotes(vault.content(gehenReadingPath) ?? "", "own"),
			vamWrite(DICTIONARY_CALLER),
		);
		expect(vault.readCount.size).toBe(0);
		expect(await notesOf(store)).toEqual(["first"]);
	});
});
