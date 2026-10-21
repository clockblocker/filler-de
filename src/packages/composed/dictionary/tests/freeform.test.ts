import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { freeformOfNote } from "../src/freeform";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import { expectIndexMatchesFiles, run } from "./support/files";
import {
	contribute,
	createLemma,
	createReading,
	gehen,
	gehenReading,
	readingEntry,
} from "./support/fixtures";
import { lemmaPath, readingPath } from "./support/paths";
import { openStore, seed } from "./support/store";

const gehenPath = lemmaPath(gehen);
const gehenReadingPath = readingPath(gehenReading);
const PLACEHOLDER = "*You can write here*";
const NOTE_TITLE =
	'<span class="note_block_title note_block_title_kontexte">Note</span>';
const MEMO =
	"My own memo about gehen.\n\nIt has [[links]] and ![[Scroll#^3|^]].";

async function withGehen() {
	const opened = await openStore();
	await seed(opened.store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
	]);
	return opened;
}

describe("appendFreeform", () => {
	test("places text under a Reading note's Note title, keeping its records and every other line", async () => {
		const { store, vault } = await withGehen();
		const before = vault.content(gehenReadingPath) ?? "";
		const outcome = await run(
			store.appendFreeform({ path: gehenReadingPath, text: MEMO }),
		);
		expect(outcome).toBe("Appended");
		const after = vault.content(gehenReadingPath) ?? "";
		// The text takes the Note placeholder's place, under the Note title;
		// no other body line changes.
		expect(before).toContain(PLACEHOLDER);
		expect(noteMetadataHelper.body(after)).toBe(
			noteMetadataHelper
				.body(before)
				.replace(
					`${NOTE_TITLE}\n${PLACEHOLDER}\n`,
					`${NOTE_TITLE}\n${MEMO}\n`,
				),
		);
		expect(freeformOfNote(after, "reading")).toEqual([MEMO]);
		await expectIndexMatchesFiles(store, vault);
	});

	test("places text last in a Lemma note", async () => {
		const { store, vault } = await withGehen();
		await run(store.appendFreeform({ path: gehenPath, text: "memo" }));
		const body = noteMetadataHelper.body(vault.content(gehenPath) ?? "");
		expect(body.trimEnd().endsWith("\n\nmemo")).toBe(true);
		await expectIndexMatchesFiles(store, vault);
	});

	test("does not add the same text twice, and later commits keep it", async () => {
		const { store, vault } = await withGehen();
		await run(store.appendFreeform({ path: gehenReadingPath, text: MEMO }));
		expect(
			await run(
				store.appendFreeform({
					path: gehenReadingPath,
					text: `${MEMO}\n`,
				}),
			),
		).toBe("AlreadyThere");
		await seed(store, [contribute(gehenReading, "to go on foot")]);
		const after = vault.content(gehenReadingPath) ?? "";
		expect(after).toContain("to go on foot");
		expect(after).toContain(MEMO);
		await expectIndexMatchesFiles(store, vault);
	});

	test("reads an edit no event delivered before placing the text", async () => {
		const { store, vault } = await withGehen();
		const edited = noteMetadataHelper.mapBody(
			(body) => `${body}\nTyped by hand.\n`,
		)(vault.content(gehenReadingPath) ?? "");
		vault.silentWrite(gehenReadingPath, edited);
		await run(store.appendFreeform({ path: gehenReadingPath, text: MEMO }));
		const after = vault.content(gehenReadingPath) ?? "";
		expect(after).toContain("Typed by hand.");
		expect(after).toContain(MEMO);
	});

	test("refuses a path the store holds no note at, and writes nothing", async () => {
		const { store, vault } = await withGehen();
		const batches = vault.batches.length;
		const exit = await Effect.runPromiseExit(
			store.appendFreeform({ path: "Worter/de/nothing.md", text: MEMO }),
		);
		expect(exit._tag).toBe("Failure");
		expect(vault.batches.length).toBe(batches);
	});
});

describe("rescan", () => {
	test("finds notes written past the store, as VAM's own moves are", async () => {
		const { store, vault } = await withGehen();
		const content = vault.content(gehenPath) ?? "";
		vault.files.delete(gehenPath);
		expect(await run(store.lemmaNote(gehen))).toBeDefined();
		await run(store.rescan);
		expect(await run(store.lemmaNote(gehen))).toBeUndefined();
		vault.silentWrite(gehenPath, content);
		await run(store.rescan);
		expect((await run(store.lemmaNote(gehen)))?.path).toBe(gehenPath);
	});
});
